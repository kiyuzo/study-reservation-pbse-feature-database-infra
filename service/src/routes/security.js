const express = require('express');
const { requireScope } = require('../auth/require-scope');
const { getDemoPersonas } = require('../auth/tokens');
const {
  getRecentSecurityEvents
} = require('../security/audit-logger');

const router = express.Router();

/**
 * Demo personas and pre-minted tokens.
 * Used by the frontend security demo to switch personas.
 */
router.get('/demo-tokens', (req, res) => {
  res.status(200).json(getDemoPersonas());
});

/**
 * Return the authenticated principal.
 */
router.get('/me', (req, res) => {
  if (!req.principal) {
    return res.status(401).json({
      type: 'https://api.library.example/problems/unauthorized',
      title: 'Authentication is required',
      status: 401,
      detail: 'A valid Bearer token is required.'
    });
  }

  return res.status(200).json({
    principal: req.principal
  });
});

/**
 * Security audit events.
 */
router.get(
  '/events',
  requireScope('admin:manage'),
  (req, res) => {
    const limit = Math.min(
      Math.max(Number(req.query.limit) || 50, 1),
      100
    );

    const events = getRecentSecurityEvents(limit);

    return res.status(200).json({
      count: events.length,
      events
    });
  }
);

module.exports = router;