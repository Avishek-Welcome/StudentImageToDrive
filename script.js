// --- Google Sheet ID and API Endpoints ---
// IMPORTANT: Replace 'YOUR_APPS_SCRIPT_WEB_APP_URL' with the actual URL
// obtained after deploying your Google Apps Script as a web app.
const SPREADSHEET_ID = '1E42C6IIupDSFCFexL0ouQteFtwiFoM1QyLwSo2rZRH0';
const GOOGLE_DRIVE_FOLDER_ID = '1RlSZT08HlcklTX81OotSM6s42YuRGF-4';

const APPS_SCRIPT_BASE_URL = 'YOUR_APPS_SCRIPT_WEB_APP_URL'; // E.g., 'https://script.google.com/macros/s/AKfycb.../exec'

const API_ENDPOINTS = {
    getSheetNames: `${https://script.google.com/macros/s/AKfycbwfLlMYmiaKmKq-itSoy6aBER7a8jiO3VOuS0T0_3rgq5d4sOdVs6ynYkagxc2JD8Am/exec}?action=getSheetNames`,
    getSheetData: `${https://script.google.com/macros/s/AKfycbwfLlMYmiaKmKq-itSoy6aBER7a8jiO3VOuS0T0_3rgq5d4sOdVs6ynYkagxc2JD8Am/exec}?action=getSheetData`,
    saveImageLink: `${https://script.google.com/macros/s/AKfycbwfLlMYmiaKmKq-itSoy6aBER7a8jiO3VOuS0T0_3rgq5d4sOdVs6ynYkagxc2JD8Am/exec}?action=saveImageLink`, // To save link to sheet
    uploadImageToDrive: `${https://script.google.com/macros/s/AKfycbwfLlMYmiaKmKq-itSoy6aBER7a8jiO3VOuS0T0_3rgq5d4sOdVs6ynYkagxc2JD8Am/exec}?action=uploadImageToDrive` // To upload image to Drive
};

// --- DOM Elements ---
const classSectionDropdown = document.getElementById('classSectionDropdown');
const rollNoDropdown = document.getElementById('rollNoDropdown');
const studentIdSpan = document.getElementById('studentId');
const studentNameSpan = document.getElementById('studentName');
const contactNumberSpan = document.getElementById('contactNumber');
const cameraFeed = document.getElementById('cameraFeed');
const canvas = document.getElementById('canvas');
const capturedImageDisplay = document.getElementById('capturedImage');
const swapCameraButton = document.getElementById('swapCameraButton');
const capturePictureButton = document.getElementById('capturePictureButton');
const savePictureButton = document.getElementById('savePictureButton');
const statusMessageDiv = document.getElementById('statusMessage');
const loadingSpinner = document.getElementById('loadingSpinner');

let currentStream;
let facingMode = 'user'; // 'user' for front camera (default), 'environment' for rear camera

// --- Utility Functions ---
function showMessage(message, type = 'info') {
    statusMessageDiv.textContent = message;
    statusMessageDiv.className = `message ${type}`;
    statusMessageDiv.style.display = 'block';
    setTimeout(() => {
        statusMessageDiv.style.display = 'none';
    }, 5000); // Hide message after 5 seconds
}

function showLoading(show) {
    loadingSpinner.style.display = show ? 'block' : 'none';
    [classSectionDropdown, rollNoDropdown, swapCameraButton, capturePictureButton, savePictureButton].forEach(btn => {
        if (show) {
            btn.setAttribute('disabled', 'true');
        } else {
            // Re-enable based on their original state or logic
            if (btn.id === 'rollNoDropdown') {
                btn.disabled = !classSectionDropdown.value;
            } else if (btn.id === 'capturePictureButton') {
                btn.disabled = !currentStream;
            } else if (btn.id === 'savePictureButton') {
                btn.disabled = !(capturedImageDisplay.src && capturedImageDisplay.style.display !== 'none' && studentIdSpan.textContent !== 'N/A');
            } else {
                btn.disabled = false;
            }
        }
    });
}


// --- Google Sheets Interaction Functions ---

/**
 * Fetches sheet names from the Google Spreadsheet to populate the Class & Section dropdown.
 */
async function fetchSheetNames() {
    showLoading(true);
    try {
        const response = await fetch(API_ENDPOINTS.getSheetNames);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const sheetNames = await response.json();

        classSectionDropdown.innerHTML = '<option value="">Select Class & Section</option>';
        if (sheetNames && sheetNames.length > 0) {
            sheetNames.forEach(name => {
                const option = document.createElement('option');
                option.value = name;
                option.textContent = name;
                classSectionDropdown.appendChild(option);
            });
            classSectionDropdown.disabled = false;
        } else {
            showMessage('No sheets found in the spreadsheet.', 'error');
            classSectionDropdown.innerHTML = '<option value="">No Sheets Found</option>';
        }
    } catch (error) {
        console.error('Error fetching sheet names:', error);
        showMessage('Failed to load sheet names. Please check console and Apps Script deployment.', 'error');
        classSectionDropdown.innerHTML = '<option value="">Error Loading Sheets</option>';
    } finally {
        showLoading(false);
    }
}

/**
 * Fetches data for the selected sheet (Class & Section) to populate the Roll No dropdown.
 * @param {string} sheetName - The name of the sheet to fetch data from.
 */
async function fetchSheetData(sheetName) {
    rollNoDropdown.innerHTML = '<option value="">Select Roll No</option>';
    rollNoDropdown.disabled = true;
    studentIdSpan.textContent = 'N/A';
    studentNameSpan.textContent = 'N/A';
    contactNumberSpan.textContent = 'N/A';
    savePictureButton.disabled = true;

    if (!sheetName) return;

    showLoading(true);
    try {
        const response = await fetch(`${API_ENDPOINTS.getSheetData}&sheetName=${encodeURIComponent(sheetName)}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json(); // Expecting an array of arrays

        if (data && data.length > 1) { // Assuming first row is header
            const rollNos = data.slice(1).map(row => row[0]).filter(Boolean); // Column A for Roll No
            rollNos.forEach(rollNo => {
                const option = document.createElement('option');
                option.value = rollNo;
                option.textContent = rollNo;
                rollNoDropdown.appendChild(option);
            });
            rollNoDropdown.disabled = false;
        } else {
            showMessage('No student data found in this sheet.', 'info');
        }
    } catch (error) {
        console.error('Error fetching sheet data:', error);
        showMessage('Failed to load roll numbers. Check sheet name and data format.', 'error');
    } finally {
        showLoading(false);
    }
}

/**
 * Displays student details (ID, Name, Contact) based on the selected Roll No.
 * @param {string} rollNo - The selected Roll Number.
 */
async function displayStudentDetails(rollNo) {
    studentIdSpan.textContent = 'N/A';
    studentNameSpan.textContent = 'N/A';
    contactNumberSpan.textContent = 'N/A';
    savePictureButton.disabled = true;

    const sheetName = classSectionDropdown.value;
    if (!sheetName || !rollNo) return;

    showLoading(true);
    try {
        const response = await fetch(`${API_ENDPOINTS.getSheetData}&sheetName=${encodeURIComponent(sheetName)}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();

        // Find the student by Roll No (Column A)
        // Assuming first row is header, so search from index 1
        const student = data.slice(1).find(row => row[0] === rollNo);

        if (student) {
            studentIdSpan.textContent = student[0] || 'N/A';   // Column A (Roll No assumed as Student ID)
            studentNameSpan.textContent = student[1] || 'N/A'; // Column B (Student Name)
            contactNumberSpan.textContent = student[5] || 'N/A'; // Column F (Student Contact Number)
            // Enable save button only if student details are loaded
            savePictureButton.disabled = !(capturedImageDisplay.src && capturedImageDisplay.style.display !== 'none');
        } else {
            showMessage('Student details not found for this Roll No.', 'info');
        }
    } catch (error) {
        console.error('Error displaying student details:', error);
        showMessage('Failed to retrieve student details.', 'error');
    } finally {
        showLoading(false);
    }
}

// --- Camera Functions ---

/**
 * Starts or restarts the camera feed with the specified facing mode.
 * @param {'user'|'environment'} mode - 'user' for front camera, 'environment' for rear camera.
 */
async function startCamera(mode) {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop()); // Stop existing tracks
    }
    try {
        const constraints = {
            video: {
                facingMode: mode,
                width: { ideal: 1280 }, // Request higher resolution for better quality
                height: { ideal: 720 }
            }
        };
        currentStream = await navigator.mediaDevices.getUserMedia(constraints);
        cameraFeed.srcObject = currentStream;
        cameraFeed.play();
        capturedImageDisplay.style.display = 'none'; // Hide captured image
        cameraFeed.style.display = 'block'; // Show camera feed
        capturePictureButton.disabled = false; // Enable capture button once camera is ready
        swapCameraButton.disabled = false;
        showMessage('Camera started successfully.', 'success');
    } catch (err) {
        console.error("Error accessing camera: ", err);
        showMessage('Could not access camera. Please ensure permissions are granted and no other app is using it.', 'error');
        capturePictureButton.disabled = true;
        swapCameraButton.disabled = true;
    }
}

/**
 * Swaps between front and rear cameras.
 */
function swapCamera() {
    facingMode = (facingMode === 'user') ? 'environment' : 'user';
    startCamera(facingMode);
}

/**
 * Captures a picture from the camera feed, crops it to 5:6.5 ratio, and displays it.
 */
function capturePicture() {
    if (!currentStream) {
        showMessage('Camera not active. Please start the camera.', 'error');
        return;
    }

    const videoWidth = cameraFeed.videoWidth;
    const videoHeight = cameraFeed.videoHeight;

    if (videoWidth === 0 || videoHeight === 0) {
        showMessage('Camera feed not ready. Please wait a moment or try again.', 'error');
        return;
    }

    // Desired aspect ratio: 5 (width) / 6.5 (height)
    const desiredAspectRatio = 5 / 6.5;

    let targetWidth, targetHeight;
    const videoAspectRatio = videoWidth / videoHeight;

    if (videoAspectRatio > desiredAspectRatio) {
        // Video is wider than desired, height is the limiting factor.
        // We'll use the full height of the video and calculate width based on desired ratio.
        targetHeight = videoHeight;
        targetWidth = videoHeight * desiredAspectRatio;
    } else {
        // Video is taller or same as desired, width is the limiting factor.
        // We'll use the full width of the video and calculate height based on desired ratio.
        targetWidth = videoWidth;
        targetHeight = videoWidth / desiredAspectRatio;
    }

    // Set canvas dimensions to the calculated target dimensions
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');

    // Calculate source coordinates to center the captured area
    const sx = (videoWidth - targetWidth) / 2;
    const sy = (videoHeight - targetHeight) / 2;

    // Draw the image from the video, cropping to the desired ratio
    ctx.drawImage(cameraFeed, sx, sy, targetWidth, targetHeight, 0, 0, targetWidth, targetHeight);

    // Convert canvas to Data URL (JPEG, 90% quality)
    capturedImageDisplay.src = canvas.toDataURL('image/jpeg', 0.9);
    capturedImageDisplay.style.display = 'block'; // Show captured image
    cameraFeed.style.display = 'none'; // Hide camera feed
    savePictureButton.disabled = !(studentIdSpan.textContent !== 'N/A'); // Enable save if student selected
    showMessage('Picture captured successfully!', 'success');
}

/**
 * Saves the captured picture to Google Drive and its link to the Google Sheet.
 */
async function savePicture() {
    const studentCode = studentIdSpan.textContent;
    const sheetName = classSectionDropdown.value;
    const rollNo = rollNoDropdown.value;

    if (studentCode === 'N/A' || !rollNo || !sheetName) {
        showMessage('Please select Class, Section, and Roll No, and ensure student details are displayed.', 'error');
        return;
    }

    if (!capturedImageDisplay.src || capturedImageDisplay.style.display === 'none') {
        showMessage('Please capture a picture first before saving.', 'error');
        return;
    }

    const imageDataUrl = capturedImageDisplay.src;
    // Extract base64 data (remove "data:image/jpeg;base64," prefix)
    const base64Data = imageDataUrl.split(',')[1];

    showLoading(true);
    try {
        // Step 1: Upload image to Google Drive
        const uploadResponse = await fetch(API_ENDPOINTS.uploadImageToDrive, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fileName: `${studentCode}.jpg`, // Image filename is Student Code
                imageData: base64Data,
                folderId: GOOGLE_DRIVE_FOLDER_ID
            })
        });

        if (!uploadResponse.ok) throw new Error(`Upload failed! status: ${uploadResponse.status}`);
        const uploadResult = await uploadResponse.json();

        if (uploadResult.success) {
            const imageUrl = uploadResult.fileLink; // Link to the uploaded image

            // Step 2: Save the image link to the Google Sheet
            const saveLinkResponse = await fetch(API_ENDPOINTS.saveImageLink, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sheetName: sheetName,
                    rollNo: rollNo, // Use Roll No to identify the correct row
                    imageLink: imageUrl
                })
            });

            if (!saveLinkResponse.ok) throw new Error(`Save link failed! status: ${saveLinkResponse.status}`);
            const saveLinkResult = await saveLinkResponse.json();

            if (saveLinkResult.success) {
                showMessage('Picture saved to Drive and link updated in Google Sheet!', 'success');
            } else {
                showMessage(`Failed to update sheet: ${saveLinkResult.error || 'Unknown error'}`, 'error');
                console.error('Failed to save image link to sheet:', saveLinkResult.error);
            }
        } else {
            showMessage(`Failed to upload picture: ${uploadResult.error || 'Unknown error'}`, 'error');
            console.error('Failed to upload image to Drive:', uploadResult.error);
        }
    } catch (error) {
        console.error('An error occurred during save:', error);
        showMessage('An unexpected error occurred while saving the picture. Check console for details.', 'error');
    } finally {
        showLoading(false);
    }
}

// --- Event Listeners ---
classSectionDropdown.addEventListener('change', (event) => {
    fetchSheetData(event.target.value);
    // Reset student details and roll number dropdown
    studentIdSpan.textContent = 'N/A';
    studentNameSpan.textContent = 'N/A';
    contactNumberSpan.textContent = 'N/A';
    savePictureButton.disabled = true;
});

rollNoDropdown.addEventListener('change', (event) => {
    displayStudentDetails(event.target.value);
});

swapCameraButton.addEventListener('click', swapCamera);
capturePictureButton.addEventListener('click', capturePicture);
savePictureButton.addEventListener('click', savePicture);

// --- Initial Setup ---
document.addEventListener('DOMContentLoaded', () => {
    fetchSheetNames();
    startCamera(facingMode); // Start front camera by default
});
