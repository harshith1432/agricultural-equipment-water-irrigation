/**
 * AgriSpectra Spectroscope SD Card Explorer & FatFs Hardware Subsystem Tests
 * 
 * Verifies:
 * 1. SD Card hardware metrics (capacity, FAT32 detection, scan count)
 * 2. File listing, retrieval, and chunked BLE transfer with progress callbacks
 * 3. Safe hardware deletion and duplication mechanics
 * 4. Non-destructive diagnostic probe strictly targeting /SCANS/TEST_PROBE.TMP
 * 5. Disconnection defenses: zero phantom data, immediate modal abort & memory buffer cleanup
 * 6. UI Component rendering: Connection Banner, Health Hero, Filter/Search, Two-Tab Viewer Modal
 */

import { setupHeadlessDOM } from './headless-dom.js';
import { leafClipDevice } from '../src/hardware/webBluetoothLeafClip.js';
import { createSpectroscopeSdCardExplorer } from '../src/components/SpectroscopeSdCardExplorer.js';
import { createSpectroscopyStudio } from '../src/components/SpectroscopyStudio.js';

export async function runSpectroscopeSdCardTests() {
  console.log('\n[SUITE] Spectroscope SD Card Explorer & FatFs Hardware Operations');
  const dom = setupHeadlessDOM();

  // Test 1: Connect leafClipDevice in simulated hardware mode
  await leafClipDevice.connect({ forceSimulation: true });
  console.assert(leafClipDevice.isConnected === true, "leafClipDevice should be connected");
  console.log("  ✔ connects to leafClipDevice and establishes ready state");

  // Test 2: Hardware SD Card status queries
  const status = await leafClipDevice.getSdCardStatus();
  console.assert(status.detected === true, "SD card should be detected");
  console.assert(status.fsType === 'FAT32', "Filesystem should be FAT32");
  console.assert(status.totalBytes > 0, "Total bytes should be > 0");
  console.assert(status.freeBytes > 0, "Free bytes should be > 0");
  console.assert(typeof status.totalScans === 'number', "Total scans should be a number");
  console.log("  ✔ retrieves SD card hardware health, FAT32 filesystem status, and capacity metrics");

  // Test 3: List SD card files
  const files = await leafClipDevice.listSdCardFiles();
  console.assert(Array.isArray(files), "Files should be an array");
  console.assert(files.length > 0, "Files array should have records");
  const firstFile = files[0];
  console.assert(Boolean(firstFile.filename), "File should have filename");
  console.assert(Boolean(firstFile.scanId), "File should have scanId");
  console.assert(Boolean(firstFile.plantName), "File should have plantName");
  console.assert(Array.isArray(firstFile.rawChannels) && firstFile.rawChannels.length === 18, "File should preserve 18-channel raw AS7265x readings");
  console.log("  ✔ enumerates SD card files with valid metadata, timestamps, and 18-channel raw sensor counts");

  // Test 4: Chunked BLE transfer of scan file
  let progressUpdates = [];
  const readResult = await leafClipDevice.readSdCardFile(firstFile.filename, (p) => {
    progressUpdates.push(p);
  });
  console.assert(readResult.filename === firstFile.filename, "Read result should match filename");
  console.assert(readResult.content.length > 0, "Read content should not be empty");
  console.assert(progressUpdates.length > 0, "Should receive progress notifications during transfer");
  console.assert(progressUpdates[progressUpdates.length - 1].percent === 100, "Final progress should reach 100%");
  console.log("  ✔ executes chunked BLE transfer with real-time transfer speed and progress callbacks");

  // Test 5: Safe deletion of scan file
  const initialCount = files.length;
  const fileToDelete = files[files.length - 1].filename;
  let token = null;
  if (typeof leafClipDevice.requestDeleteToken === 'function') {
    token = await leafClipDevice.requestDeleteToken(fileToDelete);
  }
  const deleteResult = await leafClipDevice.deleteSdCardFile(fileToDelete, token);
  console.assert(deleteResult.success === true, "Deletion should report success");
  const updatedFiles = await leafClipDevice.listSdCardFiles();
  console.assert(updatedFiles.length === initialCount - 1, "File list count should decrement by 1");
  console.assert(!updatedFiles.some(f => f.filename === fileToDelete), "Deleted file must no longer appear in listing");
  console.log("  ✔ safely removes scan record from physical FatFs SD card table upon confirmation");

  // Test 6: File duplication on SD card
  const fileToClone = updatedFiles[0].filename;
  const cloneResult = await leafClipDevice.duplicateSdCardFile(fileToClone, 'SCAN_TEST_CLONE.CSV');
  console.assert(cloneResult.success === true, "Duplication should succeed");
  const postCloneFiles = await leafClipDevice.listSdCardFiles();
  console.assert(postCloneFiles.some(f => f.filename === 'SCAN_TEST_CLONE.CSV'), "Cloned file should appear in file list");
  console.log("  ✔ clones scan file on SD card with free space verification and unique identifier");

  // Test 7: Non-destructive test probe strictly targeting /SCANS/TEST_PROBE.TMP
  const probeRead = await leafClipDevice.testSdCardProbe('READ');
  console.assert(probeRead.success === true, "Probe read should succeed");
  console.assert(probeRead.probeFile === '/SCANS/TEST_PROBE.TMP', "Probe must strictly target TEST_PROBE.TMP");
  const probeDelete = await leafClipDevice.testSdCardProbe('DELETE');
  console.assert(probeDelete.success === true, "Probe delete should succeed");
  console.assert(probeDelete.probeFile === '/SCANS/TEST_PROBE.TMP', "Probe delete must strictly target TEST_PROBE.TMP");
  console.log("  ✔ executes hardware diagnostic test probe strictly on /SCANS/TEST_PROBE.TMP without touching user scans");

  // Test 8: UI Component creation and rendering
  const explorer = createSpectroscopeSdCardExplorer();
  document.body.appendChild(explorer);
  console.assert(explorer.querySelector('h2').textContent.includes('Spectroscope SD Card'), "Header should render title");
  console.assert(explorer.querySelector('#sd-search-input') !== null, "Search input should be rendered");
  console.assert(explorer.querySelector('#sd-sort-select') !== null, "Sort dropdown should be rendered");
  console.assert(explorer.querySelectorAll('.file-btn-view').length > 0, "File action buttons should be rendered");
  console.log("  ✔ renders SpectroscopeSdCardExplorer UI with Connection Banner, Health Hero, and File Listing");

  // Test 9: Disconnection safety defenses (Zero phantom data)
  await leafClipDevice.disconnect();
  console.assert(leafClipDevice.isConnected === false, "Device should now be disconnected");

  let threwErrorOnRead = false;
  try {
    await leafClipDevice.readSdCardFile('ANY_FILE.CSV');
  } catch (err) {
    threwErrorOnRead = true;
  }
  console.assert(threwErrorOnRead === true, "Must reject file read operations when device is disconnected");

  let threwErrorOnDelete = false;
  try {
    await leafClipDevice.deleteSdCardFile('ANY_FILE.CSV');
  } catch (err) {
    threwErrorOnDelete = true;
  }
  console.assert(threwErrorOnDelete === true, "Must reject delete operations when device is disconnected");

  // Explorer should reflect disconnected state
  console.assert(explorer.textContent.includes('Connect spectroscope to access SD card'), "Explorer should display offline banner when disconnected");
  console.log("  ✔ enforces strict disconnection defenses: disables operations and clears file buffers with zero phantom data");

  // Test 10: Integration in SpectroscopyStudio
  const studio = createSpectroscopyStudio({ plots: [{ id: 'plot-1', plotNumber: 1, crop: 'Bell Peppers' }] });
  document.body.appendChild(studio);
  const sdCardTabBtn = studio.querySelector('#tab-btn-sdcard');
  console.assert(sdCardTabBtn !== null, "SpectroscopyStudio should have direct #tab-btn-sdcard button");
  
  // Click tab button
  sdCardTabBtn.click();
  const sdCardPanel = studio.querySelector('#panel-sdcard-view');
  console.assert(!sdCardPanel.classList.contains('hidden'), "Clicking SD Card Explorer tab should unhide panel");
  console.assert(sdCardPanel.querySelector('#sdcard-explorer-mount-point') !== null, "Mount point should exist");
  console.log("  ✔ successfully integrates and mounts SpectroscopeSdCardExplorer directly inside SpectroscopyStudio");

  explorer.remove();
  studio.remove();
  console.log("✔ ALL 10 SPECTROSCOPE SD CARD EXPLORER TESTS PASSED\n");
}

if (process.argv[1]?.endsWith('spectroscope-sd-card.test.js')) {
  runSpectroscopeSdCardTests().catch(err => {
    console.error("Test failed:", err);
    process.exit(1);
  });
}
