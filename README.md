# Home Assistant Energy Entity Card

A simple entity card that connects with `energy-date-selection`.

## Basic setup

Ensure the  `energy-date-selection` is added to the page. This can be added as a "Manual" card from the add card menu with the content `type: energy-date-selection`.
You can then add `custom:energy-entity-card`'s to the page.

While designed for the energy dashboard, this card also works with any other entities that use home assistants long time history.

Your card config should look something like the below. Only the `entity` and `type` are required.
```
type: custom:energy-entity-card
name: Energy used
entity: sensor.grid_energy_used
unit: 'kWh'
```

## Installation

#### HACS
1. Navigate to your home assistants HACS tab and open the "Frontend" section
2. Click the 3 dot menu in the top right hand corner.
3. Select "Custom repositories"
4. Enter `thybag/ha-energy-entity-card` as the repository, and lovelace as the category.
5. Press "Add"
6. The `energy-entity-card` should now be available in HACS when you search for it. Install it and your done.

See the [HACS Custom Repository](https://hacs.xyz/docs/faq/custom_repositories/) page for fuill details.

#### Manual
1. Copy `ha-energy-entity-card.js` to your `/var/lib/hass/www` folder.
2. Click on `Edit Dashboard`,  `Manage resources` add `/local/ha-energy-entity-card.js` as `JavaScript Module`.
