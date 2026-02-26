/**
 * Hive Mind — 33 gates as sensory nodes, 3 drones in reserve.
 * Biologically-inspired defense: workers sense, consensus decides, hive responds.
 *
 * Sensor lines (tripwires):
 *   PERIMETER (0.1): Unusual request → log, slight delay
 *   WARNING (0.5):   Attack pattern → swarm defense, decoys
 *   LETHAL (0.9):    Queen threatened → abscond, scatter, drones armed
 */

const crypto = require('crypto');

const NUM_GATES = 33;
const NUM_DRONES = 3;

const STATES = Object.freeze({
  CALM: 'CALM',
  ALERT: 'ALERT',
  SWARM: 'SWARM',
  LOCKJAW: 'LOCKJAW',
  ABSENT: 'ABSENT'
});

const SENSOR_LINES = Object.freeze({
  PERIMETER: { threshold: 0.1, response: 'log' },
  WARNING: { threshold: 0.5, response: 'swarm' },
  LETHAL: { threshold: 0.9, response: 'abscond' }
});

class SensorLine {
  constructor(name, config) {
    this.name = name;
    this.threshold = config.threshold;
    this.response = config.response;
  }

  crossed(threatLevel) {
    return threatLevel >= this.threshold;
  }
}

class HiveMind {
  constructor() {
    this.state = STATES.CALM;
    this.gates = NUM_GATES;
    this.drones = NUM_DRONES;
    this.sensorLines = [
      new SensorLine('perimeter', SENSOR_LINES.PERIMETER),
      new SensorLine('warning', SENSOR_LINES.WARNING),
      new SensorLine('lethal', SENSOR_LINES.LETHAL)
    ];
    this.lastThreat = 0;
    this.lastResponse = null;
  }

  /**
   * Each gate evaluates the attack signature. Returns 0–1 threat score.
   */
  gateEvaluate(gateId, signature) {
    const { requestCount, timingEntropy, murderCount, parallelRequests } = signature;
    const base = (murderCount || 0) / 33;
    const timing = Math.min(1, (timingEntropy || 0) * 2);
    const parallel = Math.min(1, (parallelRequests || 0) / 10);
    const gateBias = (crypto.createHash('sha256').update(`${gateId}-${requestCount}`).digest()[0] / 255) * 0.05;
    return Math.min(1, base * 0.5 + timing * 0.2 + parallel * 0.2 + gateBias);
  }

  /**
   * All 33 gates vote. Consensus = max (any gate alarmed = hive alarmed).
   */
  consensus(signature) {
    let maxThreat = 0;
    for (let g = 0; g < this.gates; g++) {
      const t = this.gateEvaluate(g, signature);
      if (t > maxThreat) maxThreat = t;
    }
    return maxThreat;
  }

  /**
   * Sense threat, check sensor lines, return response action.
   */
  sense(signature) {
    const threatLevel = this.consensus(signature);
    this.lastThreat = threatLevel;

    for (let i = this.sensorLines.length - 1; i >= 0; i--) {
      const line = this.sensorLines[i];
      if (line.crossed(threatLevel)) {
        this.lastResponse = line.response;
        return { action: line.response, threatLevel, line: line.name };
      }
    }
    return { action: 'none', threatLevel, line: null };
  }

  /**
   * Get current state (for logging)
   */
  getState() {
    return { state: this.state, lastThreat: this.lastThreat, lastResponse: this.lastResponse };
  }

  setState(s) {
    this.state = s;
  }
}

const hive = new HiveMind();

function getHive() {
  return hive;
}

function senseThreat(signature) {
  return hive.sense(signature);
}

module.exports = {
  HiveMind,
  SensorLine,
  STATES,
  SENSOR_LINES,
  getHive,
  senseThreat,
  NUM_GATES,
  NUM_DRONES
};
