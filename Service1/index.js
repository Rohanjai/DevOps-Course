const express = require('express');
const axios = require('axios');
const fs = require('fs');
const { exec } = require('child_process');
const util = require('util');

// Constants
const PORT = 8080;
const LOG_FILE = '/vStorage';
const APP_SERVICE_URL = 'http://service2:5050';
const STORAGE_SERVICE_URL = 'http://storage:5000';
const REQUEST_TIMEOUT = 2000;

// Promisify exec for async/await usage
const execAsync = util.promisify(exec);

const app = express();

// Middleware
app.use(express.json());

/**
 * Get available disk space in MB for the root filesystem
 * @returns {Promise<number|null>} Free disk space in MB or null if error
 */
async function getFreeDiskInMB() {
    try {
        const { stdout } = await execAsync('df -k /');
        const lines = stdout.trim().split('\n');

        if (lines.length < 2) {
            throw new Error('Unexpected df output format');
        }

        const parts = lines[1].split(/\s+/);
        const availKB = parseInt(parts[3], 10);

        if (isNaN(availKB)) {
            throw new Error('Could not parse available disk space');
        }

        return Math.round(availKB / 1024);
    } catch (error) {
        console.error('Error getting disk space:', error.message);
        return null;
    }
}

/**
 * Get application uptime in hours
 * @returns {string} Uptime formatted to 2 decimal places
 */
function getUptimeHours() {
    return (process.uptime() / 3600).toFixed(2);
}

/**
 * Create a timestamp record with system information
 * @returns {Promise<string>} Formatted timestamp record
 */
async function createTimestamp1Record() {
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const uptime = getUptimeHours();
    const freeMB = await getFreeDiskInMB();
    const diskInfo = freeMB !== null ? `${freeMB} MBytes` : 'unknown';

    return `Timestamp1: ${timestamp}: uptime ${uptime} hours, free disk in root: ${diskInfo}`;
}

/**
 * Post record to storage service
 * @param {string} record - The record to post
 */
async function postToStorage(record) {
    try {
        await axios.post(`${STORAGE_SERVICE_URL}/log`, record, {
            headers: { 'Content-Type': 'text/plain' },
            timeout: REQUEST_TIMEOUT
        });
    } catch (error) {
        console.warn('Could not POST to Storage:', error.message);
    }
}

/**
 * Write record to local volume storage
 * @param {string} record - The record to write
 */
function writeToVStorage(record) {
    try {
        fs.appendFileSync(LOG_FILE, record + '\n');
    } catch (error) {
        console.error('Error writing to volume storage:', error.message);
        throw error;
    }
}

/**
 * Fetch status from Service2
 * @returns {Promise<string>} Status from Service2 or error message
 */
async function fetchService2Status() {
    try {
        const response = await axios.get(`${APP_SERVICE_URL}/status`, {
            responseType: 'text',
            timeout: REQUEST_TIMEOUT
        });
        return response.data;
    } catch (error) {
        console.error('Service2 request failed:', error.message);
        return 'Service2 unavailable';
    }
}

// Routes
app.get('/status', async (req, res) => {
    try {
        // Generate timestamp record
        const timestamp1 = await createTimestamp1Record();

        // Post to storage service (non-blocking)
        await postToStorage(timestamp1);

        // Write to local volume
        writeToVStorage(timestamp1);

        // Fetch Service2 status
        const timestamp2 = await fetchService2Status();

        // Combine and send response
        const combined = `${timestamp1}\n${timestamp2}`;
        res.set('Content-Type', 'text/plain');
        res.send(combined);

    } catch (error) {
        console.error('Error in /status endpoint:', error.message);
        res.status(500).send('Error generating status');
    }
});

app.get('/log', async (req, res) => {
    try {
        const response = await axios.get(`${STORAGE_SERVICE_URL}/log`, {
            responseType: 'text',
            timeout: REQUEST_TIMEOUT
        });

        res.set('Content-Type', 'text/plain');
        res.send(response.data);

    } catch (error) {
        console.error('Error fetching logs:', error.message);
        res.status(500).send('Storage unavailable');
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Service 1 listening on port ${PORT}`);
});