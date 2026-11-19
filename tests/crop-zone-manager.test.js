/**
 * Automated Test Suite: Crop & Field Zone Manager Modal & UI Entrypoints
 * Tests:
 *   1. CropZoneManagerModal component creation, tabs, field forms, and real-time database sync.
 *   2. AppNavigationHeader Zone Dropdown "+ Manage Zones & Crops" and 3-Dot Drawer integration.
 *   3. FieldOverviewDashboard "+ Add Zone" quick action and button.
 */

import { describe, it, expect } from './framework.js';
import { setupHeadlessDOM } from './headless-dom.js';
import { createCropZoneManagerModal } from '../src/components/CropZoneManagerModal.js';
import { createAppNavigationHeader } from '../src/components/AppNavigationHeader.js';
import { createFieldOverviewDashboard } from '../src/components/dashboards/FieldOverviewDashboard.js';
import { firestoreService } from '../src/firebase/firestoreService.js';
import { mockFirestore } from '../src/firebase/mockFirestore.js';

export function registerCropZoneManagerTests() {
  setupHeadlessDOM();
  describe('UI/UX Design Bureau - CropZoneManagerModal & Real-Time Sync', () => {
    it('instantiates CropZoneManagerModal and renders both Field Zones and Crop Catalog tabs', () => {
      mockFirestore.resetToDefault();

      let closed = false;
      let selectedPlot = null;

      const modal = createCropZoneManagerModal({
        initialTab: 'zones',
        selectedPlotId: 'plot-1',
        onClose: () => { closed = true; },
        onSelectPlot: (pId) => { selectedPlot = pId; }
      });

      expect(modal).toBeDefined();
      expect(modal.innerHTML).toContain('Manage Zones & Crops');
      expect(modal.innerHTML).toContain('Field Zones');
      expect(modal.innerHTML).toContain('Crop Catalog');

      // Check for Add New Zone button
      const addZoneBtn = modal.querySelector('#btn-add-zone-view');
      expect(addZoneBtn).toBeDefined();

      // Check for close button
      const closeBtn = modal.querySelector('#btn-cz-close');
      expect(closeBtn).toBeDefined();
      closeBtn.click();
      expect(closed).toBe(true);
    });

    it('navigates to Crop Catalog tab and renders crop specifications and Add Custom Crop button', () => {
      mockFirestore.resetToDefault();

      const modal = createCropZoneManagerModal({
        initialTab: 'crops'
      });

      expect(modal.innerHTML).toContain('Crop Catalog');
      expect(modal.innerHTML).toContain('+ Add Custom Crop');

      // Check that pre-seeded crops like Potato or Tomato are listed
      expect(modal.innerHTML).toContain('Potato');
      expect(modal.innerHTML).toContain('Tomato');
    });

    it('creates a new plot via modal form and propagates to database', async () => {
      mockFirestore.resetToDefault();

      let newlySelected = null;
      const modal = createCropZoneManagerModal({
        initialTab: 'zones',
        onSelectPlot: (id) => { newlySelected = id; }
      });

      // Switch to add zone view
      const addBtn = modal.querySelector('#btn-add-zone-view');
      expect(addBtn).toBeDefined();
      addBtn.click();

      expect(modal.innerHTML).toContain('+ Add New Zone');
      expect(modal.querySelector('#form-field-zone')).toBeDefined();

      // Set input values
      const nameInput = modal.querySelector('#input-zone-name');
      const numInput = modal.querySelector('#input-zone-number');
      const vwcMinInput = modal.querySelector('#input-vwc-min');
      const vwcMaxInput = modal.querySelector('#input-vwc-max');

      if (nameInput) nameInput.value = 'Zone 9 - Millets Plot';
      if (numInput) numInput.value = '9';
      if (vwcMinInput) vwcMinInput.value = '18.0';
      if (vwcMaxInput) vwcMaxInput.value = '30.0';

      // Submit form
      const form = modal.querySelector('#form-field-zone');
      form.dispatchEvent({ type: 'submit' });

      // Allow async firestore operation
      await new Promise(r => setTimeout(r, 50));

      const catalogPlots = Object.values(mockFirestore.data.plots || {});
      const createdPlot = catalogPlots.find(p => p.plotNumber === 9 || p.name.includes('Millets'));
      expect(createdPlot).toBeDefined();
      expect(createdPlot.name).toContain('Millets');
    });

    it('adds a custom crop type via modal form and propagates to database', async () => {
      mockFirestore.resetToDefault();

      const modal = createCropZoneManagerModal({
        initialTab: 'crops'
      });

      // Switch to add crop view
      const addCropBtn = modal.querySelector('#btn-add-crop-view');
      expect(addCropBtn).toBeDefined();
      addCropBtn.click();

      expect(modal.innerHTML).toContain('Add Custom Crop');
      expect(modal.querySelector('#form-crop-type')).toBeDefined();

      const nameInput = modal.querySelector('#input-crop-name');
      const sciInput = modal.querySelector('#input-crop-scientific');
      const vwcMinInput = modal.querySelector('#input-crop-vwc-min');
      const vwcMaxInput = modal.querySelector('#input-crop-vwc-max');

      if (nameInput) nameInput.value = 'Turmeric';
      if (sciInput) sciInput.value = 'Curcuma longa';
      if (vwcMinInput) vwcMinInput.value = '25.0';
      if (vwcMaxInput) vwcMaxInput.value = '40.0';

      const form = modal.querySelector('#form-crop-type');
      form.dispatchEvent({ type: 'submit' });

      await new Promise(r => setTimeout(r, 50));

      const crops = mockFirestore.getCropCatalog();
      const turmeric = crops.find(c => c.name.toLowerCase() === 'turmeric');
      expect(turmeric).toBeDefined();
      expect(turmeric.scientificName).toBe('Curcuma longa');
      expect(turmeric.optimalVwcMin).toBe(25.0);
      expect(turmeric.optimalVwcMax).toBe(40.0);
    });

    it('deletes a plot and triggers safe fallback selection', async () => {
      mockFirestore.resetToDefault();

      let fallbackPlot = null;
      const modal = createCropZoneManagerModal({
        initialTab: 'zones',
        selectedPlotId: 'plot-1',
        onPlotDeleted: (deletedId, fallbackId) => {
          fallbackPlot = fallbackId;
        }
      });

      // Trigger delete on plot-1
      const deleteBtn = modal.querySelector('[data-action="delete-zone"][data-id="plot-1"]');
      expect(deleteBtn).toBeDefined();
      deleteBtn.click();

      // Confirm dialog should appear
      expect(modal.innerHTML).toContain('Delete Zone 1?');
      const confirmBtn = modal.querySelector('#btn-confirm-delete');
      expect(confirmBtn).toBeDefined();
      confirmBtn.click();

      await new Promise(r => setTimeout(r, 50));

      // Plot 1 should be gone from store
      const remainingPlots = Object.values(mockFirestore.data.plots || {});
      expect(remainingPlots.some(p => p.id === 'plot-1')).toBe(false);
      expect(fallbackPlot).toBeDefined();
      expect(fallbackPlot !== 'plot-1').toBe(true);
    });

    it('neutralizes malicious DOM XSS injection vectors in plots and crop types', async () => {
      mockFirestore.resetToDefault();

      // Inject an adversarial plot into Firestore data
      mockFirestore.data.plots['xss-plot'] = {
        id: 'xss-plot',
        plotNumber: 99,
        name: '<script>alert("XSS-ZONE")</script><img src=x onerror=alert(1)>Malicious Plot',
        crop: '<svg onload=alert(2)>MaliciousCrop',
        stage: 'Vegetative',
        soilType: 'Red Soil',
        targetVwcMin: 15,
        targetVwcMax: 30,
        valve: { id: 'G99', state: 'CLOSED', flowRate: 400 }
      };

      const modal = createCropZoneManagerModal({
        initialTab: 'zones',
        selectedPlotId: 'xss-plot'
      });

      // Verify that no raw script or image event handlers are executed or injected into DOM
      expect(modal.innerHTML.includes('<script>alert("XSS-ZONE")</script>')).toBe(false);
      expect(modal.innerHTML.includes('<img src=x onerror=alert(1)>')).toBe(false);
      expect(modal.innerHTML.includes('<svg onload=alert(2)>')).toBe(false);

      // Verify that content is properly sanitized and escaped
      expect(modal.innerHTML).toContain('Malicious Plot');
    });
  });

  describe('UI Entrypoints - AppNavigationHeader & FieldOverviewDashboard Integration', () => {
    it('renders Manage Zones & Crops button in AppNavigationHeader zone dropdown', () => {
      const plots = Object.values(mockFirestore.data.plots || {});
      let openedManager = false;

      const header = createAppNavigationHeader({
        plots,
        selectedPlotId: 'plot-1',
        onOpenCropZoneManager: () => { openedManager = true; }
      });

      expect(header.innerHTML).toContain('Manage Zones & Crops');
      const manageBtn = header.querySelector('#header-manage-zones-btn');
      expect(manageBtn).toBeDefined();
      manageBtn.click();
      expect(openedManager).toBe(true);
    });

    it('renders Crops & Field Zones Manager in AppNavigationHeader 3-Dot drawer', () => {
      const plots = Object.values(mockFirestore.data.plots || {});
      let openedManager = false;

      const header = createAppNavigationHeader({
        plots,
        selectedPlotId: 'plot-1',
        onOpenCropZoneManager: () => { openedManager = true; }
      });

      expect(header.innerHTML).toContain('Crops & Field Zones Manager');
      const drawerBtn = header.querySelector('#menu-btn-crop-zone-manager');
      expect(drawerBtn).toBeDefined();
      drawerBtn.click();
      expect(openedManager).toBe(true);
    });

    it('renders + Add Zone quick card and button in FieldOverviewDashboard', () => {
      const plots = Object.values(mockFirestore.data.plots || {});
      let openedManager = false;

      const dashboard = createFieldOverviewDashboard({
        plots,
        selectedPlotId: 'plot-1',
        onOpenCropZoneManager: () => { openedManager = true; }
      });

      expect(dashboard.innerHTML).toContain('+ Add Zone');
      expect(dashboard.innerHTML).toContain('+ Add New Zone');

      const topAddBtn = dashboard.querySelector('#btn-overview-manage-zones');
      expect(topAddBtn).toBeDefined();
      topAddBtn.click();
      expect(openedManager).toBe(true);

      openedManager = false;
      const bottomAddCard = dashboard.querySelector('#card-overview-add-zone');
      expect(bottomAddCard).toBeDefined();
      bottomAddCard.click();
      expect(openedManager).toBe(true);
    });
  });
}
