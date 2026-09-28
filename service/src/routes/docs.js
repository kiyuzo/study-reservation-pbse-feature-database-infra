/**
 * ============================================================================
 * INTERACTIVE API DOCUMENTATION ROUTES
 * ============================================================================
 * Serves advanced OpenAPI documentation and contract specifications.
 * ============================================================================
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const router = express.Router();
const openApiYamlPath = path.resolve(__dirname, '../../../openapi.yaml');
const docsHtmlPath = path.resolve(__dirname, '../views/docs.html');

let cachedOpenApiDoc = null;

function getOpenApiDoc(req) {
  if (!cachedOpenApiDoc) {
    const yamlContent = fs.readFileSync(openApiYamlPath, 'utf8');
    cachedOpenApiDoc = yaml.load(yamlContent);
  }

  // Clone document to safely customize servers dynamically
  const doc = JSON.parse(JSON.stringify(cachedOpenApiDoc));

  // Determine current host
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.get('host') || 'localhost:8080';
  const currentOrigin = `${protocol}://${host}`;

  doc.servers = [
    {
      url: currentOrigin,
      description: 'Current Environment'
    },
    {
      url: `${currentOrigin}/v1`,
      description: 'Current Environment (/v1 prefix)'
    },
    {
      url: 'http://localhost:8080',
      description: 'Local Development Server'
    }
  ];

  return doc;
}

// Serve Swagger UI Interactive Documentation HTML
router.get('/docs', (req, res) => {
  res.sendFile(docsHtmlPath);
});

// Serve OpenAPI as JSON
router.get('/openapi.json', (req, res) => {
  try {
    const doc = getOpenApiDoc(req);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.send(doc);
  } catch (err) {
    res.status(500).json({ error: 'Failed to parse openapi.yaml', message: err.message });
  }
});

// Serve OpenAPI as YAML
router.get('/openapi.yaml', (req, res) => {
  res.sendFile(openApiYamlPath);
});

module.exports = router;
