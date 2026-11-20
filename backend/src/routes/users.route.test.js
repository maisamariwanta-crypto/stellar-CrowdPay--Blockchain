const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const proxyquire = require('proxyquire').noCallThru();

function buildApp(queryImpl, createKycSessionImpl = async () => ({})) {
  const router = proxyquire('./users', {
    '../config/database': { query: queryImpl },
    '../middleware/auth': {
      requireAuth: (req, _res, next) => {
        req.user = { userId: 'user-1' };
        next();
      },
    },
    '../services/kycProvider': {
      createKycSession: createKycSessionImpl,
      isKycRequiredForCampaigns: () => false,
    },
  });
  const app = express();
  app.use(express.json());
  app.use('/api/users', router);
  return app;
}

test('PATCH /api/users/me strips HTML from the stored display name', async () => {
  let updateParams;
  const app = buildApp(async (text, params) => {
    if (text.includes('UPDATE users SET name')) {
      updateParams = params;
      return { rows: [{ id: 'user-1', name: 'Ada' }] };
    }
    return { rows: [] };
  });

  const response = await request(app)
    .patch('/api/users/me')
    .send({ name: '<img src=x onerror=alert(1)>Ada</img>' });

  assert.equal(response.status, 200);
  assert.deepEqual(updateParams, ['Ada', 'user-1']);
  assert.equal(response.body.name, 'Ada');
});

test('GET /api/users/me uses the single profile handler', async () => {
  let profileQueries = 0;
  const app = buildApp(async (text) => {
    if (text.includes('SELECT id, email, name, wallet_public_key')) {
      profileQueries += 1;
      return { rows: [{ id: 'user-1', name: 'Ada' }] };
    }
    return { rows: [] };
  });

  const response = await request(app).get('/api/users/me');

  assert.equal(response.status, 200);
  assert.equal(profileQueries, 1);
  assert.equal(response.body.name, 'Ada');
});

test('POST /api/users/me/kyc/start returns the existing reference for pending KYC', async () => {
  let sessionStarts = 0;
  const app = buildApp(async (text) => {
    if (text.includes('SELECT id, email, name, role, kyc_status')) {
      return {
        rows: [{
          id: 'user-1',
          email: 'ada@example.com',
          name: 'Ada',
          role: 'creator',
          kyc_status: 'pending',
          kyc_provider_reference: 'inquiry-1',
        }],
      };
    }
    return { rows: [] };
  }, async () => {
    sessionStarts += 1;
    return { providerReference: 'new-inquiry' };
  });

  const response = await request(app).post('/api/users/me/kyc/start');

  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'pending');
  assert.equal(response.body.provider_reference, 'inquiry-1');
  assert.equal(sessionStarts, 0);
});