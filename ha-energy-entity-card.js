import {
  LitElement,
  html,
  css,
} from "https://unpkg.com/lit-element@2.4.0/lit-element.js?module";

// Day diff method
const dateDiffInDays = function (a, b) {
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  // Discard the time and time-zone information.
  const utc1 = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utc2 = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());

  return Math.floor((utc2 - utc1) / MS_PER_DAY);
}

/**
 * Attempt to locate "energy-date-selection" component on the page to act as date range selector.
 * If found, subscribe to date changes triggered by it.
 */
class HaDateRangeService {  

  hass;
  // Give up if not found.
  TIMEOUT = 10000;
  listeners = [];
  pollStartAt;

  connection;
  
  constructor(hass) {
    // Store ref to HASS
    this.hass = hass;
    this.pollStartAt = Date.now();

    // Get collection, once we have it subscribe to listen for date changes.
    this.getEnergyDataCollectionPoll(
      (con) => { this.onConnect(con); }
    );
  }

  // Once connected, subscribe to date range changes
  onConnect(energyCollection) {
    this.connection = energyCollection.subscribe(collection => { 
        this.listeners.forEach(function(callback) { 
          callback(collection); 
        }); 
    });
  };

  // Wait for energyCollection to become available.
  getEnergyDataCollectionPoll(complete)
  {
      let energyCollection = null;
      // Has HA inited collection
      if (this.hass.connection['_energy']) {
        energyCollection =  this.hass.connection['_energy'];
      }
       
      if (energyCollection) {
        complete(energyCollection);
      } else if (Date.now() - this.pollStartAt > this.TIMEOUT) {
        console.error('Unable to connect to energy date selector. Make sure to add a `type: energy-date-selection` card to this screen.');
      } else {
        setTimeout(() => this.getEnergyDataCollectionPoll(complete), 100);
      }
  };

  // Register listener
  onDateRangeChange(method) {
    this.listeners.push(method);
  }

  disconnect() {
     this.listeners = [];
     // Unsub
     if(this.connection) this.connection();
  }
}

/**
 * Configuration values available
 */
class EnergyEntityCardConfig {
  /** @type {String} */
  entityId;
  /** @type {String} */
  name;
  /** @type {String} */
  units;

  constructor(config) {
    this.name = config.name ?? '';

    // Error on no entity
    if (!config.entity){
      throw new Error("Entity not set.");
    }

    this.entityId = config.entity;
    this.units = config.units;
  }
}

/**
 * The Card itself.
 */
class HaEnergyEntityCard extends LitElement {
  // Data
  dateRange;
  value = null;
  units;

  // Does card need init?
  _needsInit = true;

  // Props
  static get properties() {
    return {
      hass: { attribute: false },
      config: { attribute: false }
    };
  }

  init() {
    // HA not ready yet, wait until next render loop
    if (!this.hass){
      return;
    }

    // Bad entity?
    if (!this.hass.states[this.cardConfig.entityId]) {
      this.value = `Unkown enitity "${this.cardConfig.entityId}"`;
      return;
    }

    // Default value to current state
    this.value = this.hass.states[this.cardConfig.entityId].state;
    this.units = this.cardConfig.units ?? this.hass.states[this.cardConfig.entityId]?.attributes?.unit_of_measurement ?? '';

    // Connect to date range
    this.dateRange = new HaDateRangeService(this.hass);
    this.dateRange.onDateRangeChange((c) => {
      this.loadData(c.start, c.end);
    });

    // Don't init again
    this._needsInit = false;
  }

  // The config
  setConfig(config) {
    // Setting config to an entity config breaks card_mod
    // See
    this.config = config;
    this.cardConfig = new EnergyEntityCardConfig(config);
  }

  static getStubConfig(hass) {
    // Find a power entity for default
    const sampleEntity = Object.keys(hass.states).find(
      (entityId) => {
        const entity = hass.states[entityId];
        return (entity.state && entity.attributes && entity.attributes.device_class === 'energy'); 
      }  
    );
    // Sample config
    return {
      type: 'custom:energy-entity-card',
      name: hass.states[sampleEntity].attributes?.friendly_name,
      entity: sampleEntity
    };
  }

  // Render the card
  render() {
    // Run init if needed.
    if (this._needsInit) {
      this.init();
    }

    return html`
      <ha-card @click=${this.onClick}>
        <div class="container">
          <span class="heading">${this.cardConfig.name}</span>
          <span class="value">${this.value} ${this.units}</span>
        </div>
      </ha-card>
    `;
  };

  // Load data for timerange selected
  loadData(start, end) {
    // Based on https://github.com/MindFreeze/ha-sankey-chart/blob/master/src/energy.ts
    const dayDifference = dateDiffInDays(start, end);
    const period = dayDifference > 35 ? "month" : dayDifference > 2 ? "day" : "hour";

    this.hass.callWS({
      type: "recorder/statistics_during_period",
      start_time: start.toISOString(),
      end_time: end?.toISOString(),
      statistic_ids: [this.cardConfig.entityId],
      period: period,
      types: ["change"],
    })
    .then((results) => {
      // No results? Normally this means the future or a date you have no data for, so just 0
      if (!results[this.cardConfig.entityId]) {
        this.value = 0;
        return;
      }

      // Replace value with new one
      const value = Object.values(results[this.cardConfig.entityId]).reduce((a, b) => a + b.change, 0);
      this.value = new Intl.NumberFormat().format(value);
    });
  }

  // Card clicked
  onClick(ev) {
    // Open HA modal.
    const actions = {
        entity: this.cardConfig.entityId,
        tap_action: {
           action: "more-info",
        }
    };
    const event = new Event('hass-action', {bubbles: true, composed: true});
    event.detail = { config: actions, action: 'tap'};
    this.dispatchEvent(event);
  }

  // Styling
  static get styles() {
    return css`
      .container {
        flex-direction: column;
        display: flex;
        padding: 12px;
        cursor: pointer;
      }
      .heading {
        font-weight:500;
        text-overflow: ellipsis;
        line-height: 20px;
      }
      .value {
        font-size: 12px;
        line-height: 16px;
      }
    `;
  }

  // Cleanup
  disconnectedCallback() {
    this._needsInit = true;
    if (this.dateRange) this.dateRange.disconnect();
    super.disconnectedCallback();
  }
}

// Register component
if (!customElements.get("energy-entity-card")) {
  customElements.define("energy-entity-card", HaEnergyEntityCard);
  console.info(
    `%c 🐸 thybag/ha-energy-entity-card %c v0.0.4 `,
    'color: green; font-weight: bold;background: black;',
    'background: grey; font-weight: bold; color: #fff'
  )
}

// Register card itself
window.customCards.push({
    name: 'Energy Entity Card',
    description: 'A simple energy entity card that integrates with the `energy-date-selection`',
    type: 'energy-entity-card',
    preview: false,
    documentationURL: `https://github.com/thybag/ha-energy-entity-card`,
});
