/**
 * Database & Storage Architect Automated Test Suite
 * Comprehensive real-time CRUD, reactive subscription, and offline persistence tests
 * across Plots and Crop Catalog collections.
 */

import { describe, it, expect } from './framework.js';
import { firestoreService, FARM_ID } from '../src/firebase/firestoreService.js';
import { mockFirestore, PRIMARY_STORAGE_KEY } from '../src/firebase/mockFirestore.js';
import { authService } from '../src/firebase/authService.js';

export function registerDatabaseStorageTests() {
  describe('Database & Storage Architecture - Real-Time Plot CRUD & Reactive Synchronization', () => {
    it('creates a new plot with validation, auto-generated ID, and triggers real-time subscriber', async () => {
      mockFirestore.resetToDefault();

      let subscriberPlots = [];
      let notificationCount = 0;
      const unsubscribe = firestoreService.subscribePlots((plots) => {
        subscriberPlots = plots;
        notificationCount++;
      });

      const initialCount = subscriberPlots.length;
      expect(initialCount).toBeGreaterThan(0);

      // Create new custom plot
      const newPlotData = {
        name: 'Zone 7 - Mustard Greens Trial',
        crop: 'Mustard Greens',
        plotNumber: 7,
        stage: 'Vegetative Canopy',
        targetVwcMin: 22.5,
        targetVwcMax: 36.0,
        plantAgeDays: 14,
        totalCycleDays: 45,
        areaHa: 0.5,
        valve: {
          id: 'G7',
          state: 'CLOSED',
          flowRate: 320.0
        }
      };

      const created = await firestoreService.createPlot(newPlotData);

      expect(created).toBeDefined();
      expect(typeof created.id).toBe('string');
      expect(created.name).toBe('Zone 7 - Mustard Greens Trial');
      expect(created.crop).toBe('Mustard Greens');
      expect(created.plotNumber).toBe(7);
      expect(created.targetVwcMin).toBe(22.5);
      expect(created.targetVwcMax).toBe(36.0);
      expect(created.valve.id).toBe('G7');
      expect(created.soilSensors.length).toBe(3);

      // Verify real-time subscriber updated
      expect(subscriberPlots.length).toBe(initialCount + 1);
      const foundInSubscriber = subscriberPlots.find(p => p.id === created.id);
      expect(foundInSubscriber).toBeDefined();
      expect(foundInSubscriber.crop).toBe('Mustard Greens');

      // Verify persistence in localStorage under agrispectra_offline_db
      const storedRaw = localStorage.getItem(PRIMARY_STORAGE_KEY);
      expect(storedRaw).toBeDefined();
      const parsedStored = JSON.parse(storedRaw);
      expect(parsedStored.plots[created.id]).toBeDefined();
      expect(parsedStored.plots[created.id].name).toBe('Zone 7 - Mustard Greens Trial');

      unsubscribe();
    });

    it('updates an existing plot in real-time, modifying attributes and triggering listener', async () => {
      mockFirestore.resetToDefault();

      let latestPlots = [];
      const unsubscribe = firestoreService.subscribePlots((plots) => {
        latestPlots = plots;
      });

      // Update plot-1 attributes (e.g. stage, target VWC, plant age)
      const updatePayload = {
        crop: 'Russet Burbank Potato',
        stage: 'Harvest Window Ready',
        targetVwcMin: 26.0,
        targetVwcMax: 38.5,
        currentHeightCm: 89,
        plantAgeDays: 78
      };

      const res = await firestoreService.updatePlot('plot-1', updatePayload);
      expect(res.success).toBe(true);

      // Verify database updated
      const updatedPlot = await firestoreService.getPlot('plot-1');
      expect(updatedPlot.crop).toBe('Russet Burbank Potato');
      expect(updatedPlot.stage).toBe('Harvest Window Ready');
      expect(updatedPlot.targetVwcMin).toBe(26.0);
      expect(updatedPlot.targetVwcMax).toBe(38.5);
      expect(updatedPlot.currentHeightCm).toBe(89);

      // Verify subscriber received updated plot
      const plotInSubscriber = latestPlots.find(p => p.id === 'plot-1');
      expect(plotInSubscriber.crop).toBe('Russet Burbank Potato');
      expect(plotInSubscriber.stage).toBe('Harvest Window Ready');

      // Verify persisted to localStorage
      const stored = JSON.parse(localStorage.getItem(PRIMARY_STORAGE_KEY));
      expect(stored.plots['plot-1'].stage).toBe('Harvest Window Ready');

      unsubscribe();
    });

    it('deletes a plot from database, cleans up references, and triggers real-time listener', async () => {
      mockFirestore.resetToDefault();

      let latestPlots = [];
      const unsubscribe = firestoreService.subscribePlots((plots) => {
        latestPlots = plots;
      });

      const initialCount = latestPlots.length;
      expect(latestPlots.some(p => p.id === 'plot-6')).toBe(true);

      const deleteRes = await firestoreService.deletePlot('plot-6');
      expect(deleteRes.success).toBe(true);
      expect(deleteRes.id).toBe('plot-6');

      // Verify plot-6 is removed from database
      const fetched = await firestoreService.getPlot('plot-6');
      expect(fetched).toBeNull();

      // Verify subscriber reflects removal immediately
      expect(latestPlots.length).toBe(initialCount - 1);
      expect(latestPlots.some(p => p.id === 'plot-6')).toBe(false);

      // Verify persisted to localStorage
      const stored = JSON.parse(localStorage.getItem(PRIMARY_STORAGE_KEY));
      expect(stored.plots['plot-6']).toBeUndefined();

      unsubscribe();
    });
  });

  describe('Database & Storage Architecture - Crop Catalog Subcollection & Real-Time Sync', () => {
    it('pre-seeds all 11 standard Indian & international crop types with full agronomic parameters', async () => {
      mockFirestore.resetToDefault();

      const catalog = await firestoreService.getCropCatalog();
      expect(catalog.length).toBeGreaterThanOrEqual(11);

      const cropNames = catalog.map(c => c.name);
      const expectedCrops = [
        'Potato',
        'Tomato',
        'Bell Pepper',
        'Sweet Corn',
        'Wheat',
        'Cotton',
        'Sugarcane',
        'Paddy Rice',
        'Chilli',
        'Groundnut',
        'Soybean'
      ];

      for (const expected of expectedCrops) {
        expect(cropNames.includes(expected)).toBe(true);
      }

      // Verify thorough agronomic parameters on Potato
      const potato = catalog.find(c => c.name === 'Potato');
      expect(potato).toBeDefined();
      expect(potato.scientificName).toBe('Solanum tuberosum');
      expect(potato.optimalVwcMin).toBe(22.0);
      expect(potato.optimalVwcMax).toBe(35.0);
      expect(potato.optimalPhMin).toBe(5.5);
      expect(potato.optimalPhMax).toBe(6.5);
      expect(potato.targetNitrogen).toBe(140);
      expect(Array.isArray(potato.growthStages)).toBe(true);
      expect(potato.growthStages.includes('Tuber Bulking')).toBe(true);
    });

    it('subscribes to crop catalog and receives real-time updates when a new crop type is added', async () => {
      mockFirestore.resetToDefault();

      let catalogUpdates = [];
      const unsubscribe = firestoreService.subscribeCropCatalog((crops) => {
        catalogUpdates = crops;
      });

      const initialCount = catalogUpdates.length;

      // Farmer adds a new exotic crop: Dragonfruit
      const newCrop = await firestoreService.addCropType({
        name: 'Dragon Fruit',
        scientificName: 'Selenicereus undatus',
        optimalVwcMin: 15.0,
        optimalVwcMax: 25.0,
        optimalPhMin: 6.0,
        optimalPhMax: 7.0,
        targetNitrogen: 80,
        growthStages: ['Planting', 'Vegetative Climbing', 'Bud Initiation', 'Flowering', 'Fruit Ripening'],
        category: 'Exotic Fruit',
        defaultCycleDays: 180
      });

      expect(newCrop).toBeDefined();
      expect(newCrop.id).toBeDefined();
      expect(newCrop.name).toBe('Dragon Fruit');

      // Verify real-time subscriber updated
      expect(catalogUpdates.length).toBe(initialCount + 1);
      const foundInListener = catalogUpdates.find(c => c.name === 'Dragon Fruit');
      expect(foundInListener).toBeDefined();
      expect(foundInListener.optimalVwcMin).toBe(15.0);

      // Verify persisted to localStorage
      const stored = JSON.parse(localStorage.getItem(PRIMARY_STORAGE_KEY));
      expect(stored.crops[newCrop.id]).toBeDefined();
      expect(stored.crops[newCrop.id].scientificName).toBe('Selenicereus undatus');

      unsubscribe();
    });

    it('updates a crop type in database and propagates to subscribers and offline storage', async () => {
      mockFirestore.resetToDefault();

      let latestCatalog = [];
      const unsubscribe = firestoreService.subscribeCropCatalog((crops) => {
        latestCatalog = crops;
      });

      // Update Wheat agronomic target values
      const updated = await firestoreService.updateCropType('crop-wheat', {
        optimalVwcMin: 19.5,
        optimalVwcMax: 29.5,
        targetNitrogen: 135
      });

      expect(updated).toBeDefined();
      expect(updated.optimalVwcMin).toBe(19.5);
      expect(updated.optimalVwcMax).toBe(29.5);
      expect(updated.targetNitrogen).toBe(135);

      // Verify subscriber got the update
      const wheatInListener = latestCatalog.find(c => c.id === 'crop-wheat');
      expect(wheatInListener.optimalVwcMin).toBe(19.5);
      expect(wheatInListener.targetNitrogen).toBe(135);

      // Verify localStorage persistence
      const stored = JSON.parse(localStorage.getItem(PRIMARY_STORAGE_KEY));
      expect(stored.crops['crop-wheat'].targetNitrogen).toBe(135);

      unsubscribe();
    });

    it('deletes a crop type from database and propagates removal in real time', async () => {
      mockFirestore.resetToDefault();

      let latestCatalog = [];
      const unsubscribe = firestoreService.subscribeCropCatalog((crops) => {
        latestCatalog = crops;
      });

      const initialCount = latestCatalog.length;
      expect(latestCatalog.some(c => c.id === 'crop-soybean')).toBe(true);

      const delRes = await firestoreService.deleteCropType('crop-soybean');
      expect(delRes.success).toBe(true);
      expect(delRes.id).toBe('crop-soybean');

      // Verify subscriber shows item removed
      expect(latestCatalog.length).toBe(initialCount - 1);
      expect(latestCatalog.some(c => c.id === 'crop-soybean')).toBe(false);

      // Verify localStorage reflects removal
      const stored = JSON.parse(localStorage.getItem(PRIMARY_STORAGE_KEY));
      expect(stored.crops['crop-soybean']).toBeUndefined();

      unsubscribe();
    });

    it('recovers full database state across cold app restarts from localStorage', async () => {
      mockFirestore.resetToDefault();

      // Add a custom plot and custom crop
      const createdPlot = await firestoreService.createPlot({
        name: 'Zone 99 - Cold Restart Test',
        crop: 'Cold Restart Crop',
        plotNumber: 99
      });

      const createdCrop = await firestoreService.addCropType({
        name: 'Cold Restart Quinoa',
        scientificName: 'Chenopodium quinoa',
        optimalVwcMin: 16.0,
        optimalVwcMax: 26.0
      });

      // Verify stored in agrispectra_offline_db
      const rawDb = localStorage.getItem(PRIMARY_STORAGE_KEY);
      expect(rawDb).toBeDefined();

      // Simulate cold app restart: load data fresh from storage into mockFirestore
      const freshLoaded = mockFirestore.loadData();
      expect(freshLoaded.plots[createdPlot.id]).toBeDefined();
      expect(freshLoaded.plots[createdPlot.id].name).toBe('Zone 99 - Cold Restart Test');
      expect(freshLoaded.crops[createdCrop.id]).toBeDefined();
      expect(freshLoaded.crops[createdCrop.id].name).toBe('Cold Restart Quinoa');
    });
  });

  describe('Database & Storage Architecture - Multi-Tenant Isolation Chambers & Connectivity Verification', () => {
    it('verifies active database connectivity and returns latency, health, and document sync metrics', async () => {
      const status = await firestoreService.verifyDatabaseConnection();
      expect(status).toBeDefined();
      expect(status.connected).toBe(true);
      expect(['LIVE_CLOUD', 'ISOLATED_LOCAL'].includes(status.mode)).toBe(true);
      expect(typeof status.latencyMs).toBe('number');
      expect(status.latencyMs).toBeGreaterThan(0);
      expect(typeof status.farmId).toBe('string');
      expect(status.farmId.length).toBeGreaterThan(0);
      expect(typeof status.userId).toBe('string');
      expect(typeof status.syncedCount).toBe('number');
      expect(status.error).toBe(null);
    });

    it('enforces complete multi-tenant user isolation chamber between User A (Carlos) and User B (Elena)', async () => {
      mockFirestore.resetToDefault();

      // 1. Establish User A (Carlos Mendoza) in farm-carlos-valley-1
      const userCarlos = {
        uid: 'user-carlos-1',
        displayName: 'Carlos Mendoza',
        email: 'carlos.mendoza@valleyfarms.com',
        role: 'Farm Owner',
        farmId: 'farm-carlos-valley-1'
      };
      firestoreService.setActiveUser(userCarlos);

      let carlosActivePlots = [];
      const unsubCarlosPlots = firestoreService.subscribePlots((plots) => {
        carlosActivePlots = plots;
      });

      // User A creates plot "Zone 7 - Carlos Special"
      const carlosPlot = await firestoreService.createPlot({
        id: 'plot-carlos-special-7',
        name: 'Zone 7 - Carlos Special',
        crop: 'Heirloom Grapevines',
        plotNumber: 7,
        stage: 'Fruiting',
        targetVwcMin: 18.0,
        targetVwcMax: 26.0
      });

      expect(carlosPlot).toBeDefined();
      expect(carlosActivePlots.some(p => p.name === 'Zone 7 - Carlos Special')).toBe(true);
      unsubCarlosPlots();

      // 2. Switch to User B (Dr. Elena Rostova) in farm-elena-research-2
      const userElena = {
        uid: 'user-elena-2',
        displayName: 'Dr. Elena Rostova',
        email: 'elena.rostova@solenoidflow.org',
        role: 'SuperAdmin',
        farmId: 'farm-elena-research-2'
      };
      firestoreService.setActiveUser(userElena);

      let elenaActivePlots = [];
      let elenaActiveCrops = [];
      const unsubElenaPlots = firestoreService.subscribePlots((plots) => {
        elenaActivePlots = plots;
      });
      const unsubElenaCrops = firestoreService.subscribeCropCatalog((crops) => {
        elenaActiveCrops = crops;
      });

      // VERIFY: Elena cannot see "Zone 7 - Carlos Special"
      expect(elenaActivePlots.some(p => p.name === 'Zone 7 - Carlos Special')).toBe(false);
      expect(elenaActivePlots.some(p => p.id === 'plot-carlos-special-7')).toBe(false);

      // User B creates a crop "Golden Saffron" in research chamber
      const elenaCrop = await firestoreService.addCropType({
        name: 'Golden Saffron',
        scientificName: 'Crocus sativus',
        optimalVwcMin: 14.0,
        optimalVwcMax: 22.0,
        optimalPhMin: 6.0,
        optimalPhMax: 7.5,
        targetNitrogen: 75,
        category: 'Exotic Spice'
      });

      expect(elenaCrop).toBeDefined();
      expect(elenaActiveCrops.some(c => c.name === 'Golden Saffron')).toBe(true);
      unsubElenaPlots();
      unsubElenaCrops();

      // 3. Switch back to User A (Carlos) in farm-carlos-valley-1
      firestoreService.setActiveUser(userCarlos);

      let carlosReturnedPlots = [];
      let carlosReturnedCrops = [];
      const unsubCarlos2 = firestoreService.subscribePlots((plots) => {
        carlosReturnedPlots = plots;
      });
      const unsubCarlosCrops2 = firestoreService.subscribeCropCatalog((crops) => {
        carlosReturnedCrops = crops;
      });

      // VERIFY: Carlos CANNOT see "Golden Saffron" created by Elena
      expect(carlosReturnedCrops.some(c => c.name === 'Golden Saffron')).toBe(false);

      // VERIFY: Carlos STILL has his "Zone 7 - Carlos Special"
      expect(carlosReturnedPlots.some(p => p.name === 'Zone 7 - Carlos Special')).toBe(true);
      unsubCarlos2();
      unsubCarlosCrops2();

      // 4. Verify LocalStorage Partition Keys ensure zero cross-tenant contamination
      const rawCarlosChamber = localStorage.getItem('agrispectra_offline_db_farm-carlos-valley-1');
      expect(rawCarlosChamber).toBeDefined();
      expect(rawCarlosChamber.includes('Zone 7 - Carlos Special')).toBe(true);
      expect(rawCarlosChamber.includes('Golden Saffron')).toBe(false);

      const rawElenaChamber = localStorage.getItem('agrispectra_offline_db_farm-elena-research-2');
      expect(rawElenaChamber).toBeDefined();
      expect(rawElenaChamber.includes('Golden Saffron')).toBe(true);
      expect(rawElenaChamber.includes('Zone 7 - Carlos Special')).toBe(false);
    });

    it('dynamically initializes a fresh independent farm chamber for newly registered users with zero data leaks', async () => {
      mockFirestore.resetToDefault();

      const newUserId = `usr-isolated-${Date.now()}`;
      const newUser = {
        uid: newUserId,
        displayName: 'Amara Patel',
        email: 'amara.patel@agrocloud.io',
        role: 'Farm Owner',
        farmId: `farm_${newUserId}`,
        farmName: 'Deccan Plateau Drip Block'
      };

      firestoreService.setActiveUser(newUser);

      // Verify dynamically generated chamber
      const farmDoc = await firestoreService.getFarm();
      expect(farmDoc.farmId).toBe(`farm_${newUserId}`);

      const plots = await firestoreService.getPlots();
      expect(plots.length).toBe(1);
      expect(plots[0].plotNumber).toBe(1);

      // Verify persistence key is partition-isolated
      const storedChamber = localStorage.getItem(`agrispectra_offline_db_farm_${newUserId}`);
      expect(storedChamber).toBeDefined();
      const parsed = JSON.parse(storedChamber);
      expect(parsed.farmId).toBe(`farm_${newUserId}`);
    });

    it('switches demo roles via AuthService and updates active Firestore chamber seamlessly', async () => {
      mockFirestore.resetToDefault();

      // Login as Mateo Silva (Central Valley Hydraulic Orchard)
      await authService.loginAsDemoRole('Field Operator');
      const currentUser = authService.getCurrentUser();
      expect(currentUser.displayName).toBe('Mateo Silva');
      expect(currentUser.farmId).toBe('farm-mateo-hydraulic-3');

      // Verify firestoreService has bound to Mateo's orchard chamber
      const mateoPlots = await firestoreService.getPlots();
      expect(mateoPlots.some(p => p.crop === 'Citrus' || p.name.includes('Citrus'))).toBe(true);

      // Verify Mateo's chamber does not contain Carlos's potato or tomato plots
      expect(mateoPlots.some(p => p.name.includes('Potato Field Zone'))).toBe(false);

      // Switch to Carlos Mendoza (Sonoma Valley Drip Vineyard)
      await authService.loginAsDemoRole('Farm Owner');
      const carlosUser = authService.getCurrentUser();
      expect(carlosUser.displayName).toBe('Carlos Mendoza');
      expect(carlosUser.farmId).toBe('farm-carlos-valley-1');

      const carlosPlots = await firestoreService.getPlots();
      expect(carlosPlots.some(p => p.name.includes('Potato Field Zone'))).toBe(true);
    });
  });
}
