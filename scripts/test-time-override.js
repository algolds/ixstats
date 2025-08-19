// Quick test to directly set time override
const { IxTime } = require('../src/lib/ixtime.ts');

// Set the override directly
const correctTime = 2209440080000; // January 6, 2040
IxTime.setTimeOverride(correctTime);
IxTime.setMultiplierOverride(2);

console.log('Override set to:', new Date(correctTime).toISOString());
console.log('Current IxTime:', IxTime.getCurrentIxTime());
console.log('Formatted:', IxTime.formatIxTime(IxTime.getCurrentIxTime(), true));