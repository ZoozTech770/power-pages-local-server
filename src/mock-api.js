const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');
const { v4: uuidv4 } = require('uuid');

class MockApi {
  constructor(config) {
    this.config = config;
    this.mockDataPath = path.join(__dirname, '../mock-data');
    this.initializeMockData();
  }

  async initializeMockData() {
    try {
      await fs.ensureDir(this.mockDataPath);
      
      // Create mock data files if they don't exist
      await this.createMockDataFiles();
      
      console.log(chalk.green('✅ Mock API initialized'));
    } catch (error) {
      console.error(chalk.red('❌ Failed to initialize Mock API:'), error);
    }
  }

  async createMockDataFiles() {
    // Users mock data
    const usersData = {
      currentUser: {
        id: 'user-123',
        fullname: 'אריה כהן',
        email: 'arye.cohen@example.com',
        roles: ['לקוח- הגשת בקשות', 'Administrators'],
        isAuthenticated: true,
        profile: {
          firstName: 'אריה',
          lastName: 'כהן',
          phone: '050-1234567',
          address: 'תל אביב, ישראל'
        }
      },
      allUsers: [
        {
          id: 'user-123',
          fullname: 'אריה כהן',
          email: 'arye.cohen@example.com',
          roles: ['לקוח- הגשת בקשות']
        },
        {
          id: 'user-456',
          fullname: 'שרה לוי',
          email: 'sarah.levi@example.com',
          roles: ['Administrators']
        }
      ]
    };

    // Messages mock data
    const messagesData = {
      messages: [
        {
          id: 'msg-001',
          title: 'בקשתך אושרה',
          content: 'בקשתך למספר 123456 אושרה וזמינה לצפייה',
          timestamp: '2025-07-15T10:30:00Z',
          read: false,
          type: 'approval'
        },
        {
          id: 'msg-002',
          title: 'עדכון מערכת',
          content: 'המערכת תעבור תחזוקה ביום חמישי בין השעות 22:00-24:00',
          timestamp: '2025-07-14T15:45:00Z',
          read: true,
          type: 'system'
        }
      ],
      unreadCount: 1
    };

    // Search mock data
    const searchData = {
      results: [
        {
          title: 'איך להגיש בקשה',
          content: 'מדריך מלא להגשת בקשות במערכת',
          url: '/guide/submit-request',
          type: 'guide'
        },
        {
          title: 'שאלות נפוצות',
          content: 'תשובות לשאלות הנפוצות ביותר',
          url: '/faq',
          type: 'faq'
        }
      ]
    };

    // Requests mock data
    const requestsData = {
      requests: [
        {
          id: 'req-001',
          number: '123456',
          title: 'בקשה לאישור',
          status: 'approved',
          submittedDate: '2025-07-10T09:00:00Z',
          lastUpdated: '2025-07-15T10:30:00Z',
          type: 'approval'
        },
        {
          id: 'req-002',
          number: '123457',
          title: 'בקשה נוספת',
          status: 'pending',
          submittedDate: '2025-07-14T14:20:00Z',
          lastUpdated: '2025-07-14T14:20:00Z',
          type: 'general'
        }
      ]
    };

    // Settings mock data
    const settingsData = {
      site: {
        name: 'פיקוד העורף',
        description: 'מערכת הגשת בקשות',
        language: 'he-IL',
        timezone: 'Asia/Jerusalem'
      },
      features: {
        searchEnabled: true,
        profileEnabled: true,
        messagesEnabled: true,
        formsEnabled: true
      }
    };

    // Incidents mock data
    const incidentsData = {
      value: [
        {
          incidentid: 'incident-001',
          title: 'אירוע חירום - אזעקה באזור המרכז',
          createdon: '2025-07-15T08:30:00Z',
          _oref_status_id_value: 'active',
          _oref_incident_classification_id_value: 'rocket-alert',
          oref_is_sent_to_safe: true,
          oref_num_ticketnumber: 'TKT-2025-001',
          incident_oref_messageses: [
            {
              activityid: 'msg-001',
              statuscode: 998920002
            }
          ]
        },
        {
          incidentid: 'incident-002',
          title: 'אירוע חירום - אזעקה בדרום',
          createdon: '2025-07-15T09:15:00Z',
          _oref_status_id_value: 'resolved',
          _oref_incident_classification_id_value: 'rocket-alert',
          oref_is_sent_to_safe: false,
          oref_num_ticketnumber: 'TKT-2025-002',
          incident_oref_messageses: []
        },
        {
          incidentid: 'incident-003',
          title: 'אירוע חירום - אזעקה בצפון',
          createdon: '2025-07-15T10:00:00Z',
          _oref_status_id_value: 'active',
          _oref_incident_classification_id_value: 'rocket-alert',
          oref_is_sent_to_safe: true,
          oref_num_ticketnumber: 'TKT-2025-003',
          incident_oref_messageses: [
            {
              activityid: 'msg-002',
              statuscode: 998920002
            }
          ]
        }
      ]
    };

    // Write mock data files
    await fs.writeJson(path.join(this.mockDataPath, 'users.json'), usersData, { spaces: 2 });
    await fs.writeJson(path.join(this.mockDataPath, 'messages.json'), messagesData, { spaces: 2 });
    await fs.writeJson(path.join(this.mockDataPath, 'search.json'), searchData, { spaces: 2 });
    await fs.writeJson(path.join(this.mockDataPath, 'requests.json'), requestsData, { spaces: 2 });
    await fs.writeJson(path.join(this.mockDataPath, 'settings.json'), settingsData, { spaces: 2 });
    await fs.writeJson(path.join(this.mockDataPath, 'incidents.json'), incidentsData, { spaces: 2 });
  }

  async addMockDelay() {
    if (this.config.mockApi.delay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.config.mockApi.delay));
    }
  }

  shouldSimulateError() {
    return Math.random() < this.config.mockApi.errorRate;
  }

  async getCurrentUser(req, res) {
    try {
      await this.addMockDelay();
      
      if (this.shouldSimulateError()) {
        return res.status(500).json({ error: 'Simulated server error' });
      }

      // Check if mock user is enabled
      if (!this.config.mockUser.enabled) {
        console.log(chalk.blue('🔐 Mock API: getCurrentUser (no user - disabled)'));
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const usersData = await fs.readJson(path.join(this.mockDataPath, 'users.json'));
      
      console.log(chalk.blue('🔐 Mock API: getCurrentUser'));
      res.json(usersData.currentUser);
      
    } catch (error) {
      console.error(chalk.red('❌ Mock API error (getCurrentUser):'), error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getUserMessages(req, res) {
    try {
      await this.addMockDelay();
      
      if (this.shouldSimulateError()) {
        return res.status(500).json({ error: 'Simulated server error' });
      }

      const messagesData = await fs.readJson(path.join(this.mockDataPath, 'messages.json'));
      
      console.log(chalk.blue('📬 Mock API: getUserMessages'));
      res.json(messagesData);
      
    } catch (error) {
      console.error(chalk.red('❌ Mock API error (getUserMessages):'), error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async handleSearch(req, res) {
    try {
      await this.addMockDelay();
      
      if (this.shouldSimulateError()) {
        return res.status(500).json({ error: 'Simulated server error' });
      }

      const query = req.query.q || '';
      const searchData = await fs.readJson(path.join(this.mockDataPath, 'search.json'));
      
      // Filter results based on query
      let filteredResults = searchData.results;
      if (query) {
        filteredResults = searchData.results.filter(result => 
          result.title.includes(query) || result.content.includes(query)
        );
      }
      
      console.log(chalk.blue(`🔍 Mock API: handleSearch (query: "${query}")`));
      res.json({
        query,
        results: filteredResults,
        totalCount: filteredResults.length
      });
      
    } catch (error) {
      console.error(chalk.red('❌ Mock API error (handleSearch):'), error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async handleFormSubmit(req, res) {
    try {
      await this.addMockDelay();
      
      if (this.shouldSimulateError()) {
        return res.status(500).json({ error: 'Simulated server error' });
      }

      const formData = req.body;
      const requestId = uuidv4();
      const requestNumber = Math.floor(Math.random() * 900000) + 100000;
      
      // Simulate form processing
      const response = {
        success: true,
        requestId,
        requestNumber: requestNumber.toString(),
        message: 'הבקשה נשלחה בהצלחה',
        timestamp: new Date().toISOString()
      };
      
      console.log(chalk.blue('📝 Mock API: handleFormSubmit'));
      console.log(chalk.gray('Form data:'), formData);
      
      res.json(response);
      
    } catch (error) {
      console.error(chalk.red('❌ Mock API error (handleFormSubmit):'), error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getUserRequests(req, res) {
    try {
      await this.addMockDelay();
      
      if (this.shouldSimulateError()) {
        return res.status(500).json({ error: 'Simulated server error' });
      }

      const requestsData = await fs.readJson(path.join(this.mockDataPath, 'requests.json'));
      
      console.log(chalk.blue('📋 Mock API: getUserRequests'));
      res.json(requestsData);
      
    } catch (error) {
      console.error(chalk.red('❌ Mock API error (getUserRequests):'), error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getSettings(req, res) {
    try {
      await this.addMockDelay();
      
      if (this.shouldSimulateError()) {
        return res.status(500).json({ error: 'Simulated server error' });
      }

      const settingsData = await fs.readJson(path.join(this.mockDataPath, 'settings.json'));
      
      console.log(chalk.blue('⚙️ Mock API: getSettings'));
      res.json(settingsData);
      
    } catch (error) {
      console.error(chalk.red('❌ Mock API error (getSettings):'), error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getIncidents(req, res) {
    try {
      await this.addMockDelay();
      
      if (this.shouldSimulateError()) {
        return res.status(500).json({ error: 'Simulated server error' });
      }

      const incidentsData = await fs.readJson(path.join(this.mockDataPath, 'incidents.json'));
      
      console.log(chalk.blue('🚨 Mock API: getIncidents'));
      res.json(incidentsData);
      
    } catch (error) {
      console.error(chalk.red('❌ Mock API error (getIncidents):'), error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getIncident(req, res) {
    try {
      await this.addMockDelay();
      
      if (this.shouldSimulateError()) {
        return res.status(500).json({ error: 'Simulated server error' });
      }

      const incidentId = req.params.id;
      const incidentsData = await fs.readJson(path.join(this.mockDataPath, 'incidents.json'));
      
      const incident = incidentsData.value.find(inc => inc.incidentid === incidentId);
      
      if (!incident) {
        return res.status(404).json({ error: 'Incident not found' });
      }
      
      console.log(chalk.blue(`🚨 Mock API: getIncident (${incidentId})`));
      res.json(incident);
      
    } catch (error) {
      console.error(chalk.red('❌ Mock API error (getIncident):'), error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async createIncident(req, res) {
    try {
      await this.addMockDelay();
      
      if (this.shouldSimulateError()) {
        return res.status(500).json({ error: 'Simulated server error' });
      }

      const incidentData = req.body;
      const incidentId = uuidv4();
      
      const newIncident = {
        incidentid: incidentId,
        title: incidentData.title || 'אירוע חדש',
        createdon: new Date().toISOString(),
        _oref_status_id_value: 'active',
        _oref_incident_classification_id_value: incidentData.classification || 'general',
        oref_is_sent_to_safe: false,
        oref_num_ticketnumber: `TKT-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
        incident_oref_messageses: [],
        ...incidentData
      };
      
      const incidentsData = await fs.readJson(path.join(this.mockDataPath, 'incidents.json'));
      incidentsData.value.push(newIncident);
      await fs.writeJson(path.join(this.mockDataPath, 'incidents.json'), incidentsData, { spaces: 2 });
      
      console.log(chalk.blue('🚨 Mock API: createIncident'));
      res.status(201).json(newIncident);
      
    } catch (error) {
      console.error(chalk.red('❌ Mock API error (createIncident):'), error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async updateIncident(req, res) {
    try {
      await this.addMockDelay();
      
      if (this.shouldSimulateError()) {
        return res.status(500).json({ error: 'Simulated server error' });
      }

      const incidentId = req.params.id;
      const updateData = req.body;
      
      const incidentsData = await fs.readJson(path.join(this.mockDataPath, 'incidents.json'));
      const incidentIndex = incidentsData.value.findIndex(inc => inc.incidentid === incidentId);
      
      if (incidentIndex === -1) {
        return res.status(404).json({ error: 'Incident not found' });
      }
      
      incidentsData.value[incidentIndex] = {
        ...incidentsData.value[incidentIndex],
        ...updateData
      };
      
      await fs.writeJson(path.join(this.mockDataPath, 'incidents.json'), incidentsData, { spaces: 2 });
      
      console.log(chalk.blue(`🚨 Mock API: updateIncident (${incidentId})`));
      res.json(incidentsData.value[incidentIndex]);
      
    } catch (error) {
      console.error(chalk.red('❌ Mock API error (updateIncident):'), error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = MockApi;
