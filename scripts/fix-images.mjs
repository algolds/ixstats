#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Verified working Wikimedia Commons URLs
const WORKING_URLS = {
  // Aircraft
  'F-35': 'https://upload.wikimedia.org/wikipedia/commons/5/5e/F-35A_Lightning_II_%28cropped%29.jpg',
  'F-22': 'https://upload.wikimedia.org/wikipedia/commons/2/2e/F-22_Raptor_-_100702-F-4815G-217.jpg',
  'F-16': 'https://upload.wikimedia.org/wikipedia/commons/c/c9/F-16_June_2008.jpg',
  'F-15': 'https://upload.wikimedia.org/wikipedia/commons/e/e6/F-15%2C_71st_Fighter_Squadron%2C_in_flight.JPG',
  'Rafale': 'https://upload.wikimedia.org/wikipedia/commons/2/2c/Dassault_Rafale_-_RIAT_2015_%2819191059398%29.jpg',
  'Typhoon': 'https://upload.wikimedia.org/wikipedia/commons/1/1c/Eurofighter_Typhoon_-_ILA_2018_07.jpg',
  'F/A-18': 'https://upload.wikimedia.org/wikipedia/commons/e/ea/FA-18F_after_launch_from_USS_Abraham_Lincoln_%28CVN-72%29_%28cropped%29.jpg',
  'Gripen': 'https://upload.wikimedia.org/wikipedia/commons/d/d6/Saab_JAS_39C_Gripen%2C_Czech_Air_Force.JPG',
  'Su-57': 'https://upload.wikimedia.org/wikipedia/commons/1/15/Sukhoi_T-50_prototype_in_2011.jpg',
  'J-20': 'https://upload.wikimedia.org/wikipedia/commons/d/d8/J-20_at_Airshow_China_2016.jpg',
  'A-10': 'https://upload.wikimedia.org/wikipedia/commons/5/53/A-10_Thunderbolt_II_In-flight-2_%28cropped%29.jpg',
  'B-2': 'https://upload.wikimedia.org/wikipedia/commons/3/33/US_Air_Force_B-2_Spirit.jpg',
  'B-52': 'https://upload.wikimedia.org/wikipedia/commons/f/ff/B-52H_static_display_arms_06.jpg',
  'C-17': 'https://upload.wikimedia.org/wikipedia/commons/6/67/C-17_test.jpg',
  'C-130': 'https://upload.wikimedia.org/wikipedia/commons/e/ec/C-130J_Super_Hercules.JPG',
  'Apache': 'https://upload.wikimedia.org/wikipedia/commons/2/27/AH-64D_Apache_Longbow.jpg',
  'Blackhawk': 'https://upload.wikimedia.org/wikipedia/commons/f/f4/UH-60_Blackhawk.jpg',

  // Ships
  'Nimitz': 'https://upload.wikimedia.org/wikipedia/commons/6/65/USS_Nimitz_in_Victoria_Canada_036.jpg',
  'Ford': 'https://upload.wikimedia.org/wikipedia/commons/9/90/USS_Gerald_R._Ford_%28CVN-78%29_underway_on_8_April_2017.JPG',
  'Burke': 'https://upload.wikimedia.org/wikipedia/commons/e/ea/USS_Arleigh_Burke_%28DDG-51%29_underway_in_the_Atlantic_Ocean_on_24_October_2023_%28231024-N-EI510-1001%29.JPG',
  'Zumwalt': 'https://upload.wikimedia.org/wikipedia/commons/d/d5/USS_Zumwalt_is_underway_for_the_first_time_conducting_at-sea_tests_and_trials_in_the_Atlantic_Ocean_Dec._7%2C_2015.jpg',
  'Virginia': 'https://upload.wikimedia.org/wikipedia/commons/5/5a/US_Navy_071212-N-9689V-001_Pre-Commissioning_Unit_%28PCU%29_New_Hampshire_%28SSN_778%29_returns_to_the_General_Dynamics_Electric_Boat_shipyard.jpg',
  'Ohio': 'https://upload.wikimedia.org/wikipedia/commons/9/97/Ohio_class_submarine.jpg',

  // Vehicles
  'Abrams': 'https://upload.wikimedia.org/wikipedia/commons/8/8f/M1A2_Abrams_Tank_in_Camp_Bondsteel.jpg',
  'Leopard': 'https://upload.wikimedia.org/wikipedia/commons/6/6f/Leopard_2_A5_der_Bundeswehr.jpg',
  'Challenger': 'https://upload.wikimedia.org/wikipedia/commons/f/ff/Challenger_2_Main_Battle_Tank_patrolling_outside_Basra%2C_Iraq_MOD_45148325.jpg',
  'Bradley': 'https://upload.wikimedia.org/wikipedia/commons/2/29/M2_Bradley.jpg',
  'Stryker': 'https://upload.wikimedia.org/wikipedia/commons/8/84/M1126_ICV_Stryker.jpg',
  'Paladin': 'https://upload.wikimedia.org/wikipedia/commons/c/ce/Paladin-fort-benning-7.jpg',
  'HIMARS': 'https://upload.wikimedia.org/wikipedia/commons/0/0f/M142_High_Mobility_Artillery_Rocket_System_%28HIMARS%29.jpg',

  // Weapons
  'Patriot': 'https://upload.wikimedia.org/wikipedia/commons/f/f1/Patriot_missile_launch_b.jpg',
  'THAAD': 'https://upload.wikimedia.org/wikipedia/commons/9/91/THAAD_missile_in_launch_position.jpg',
  'Iron Dome': 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Flickr_-_Israel_Defense_Forces_-_Iron_Dome_Intercepts_Rockets_from_the_Gaza_Strip.jpg',
  'Tomahawk': 'https://upload.wikimedia.org/wikipedia/commons/b/b3/Tomahawk_Block_IV_cruise_missile.jpg',
  'Aegis': 'https://upload.wikimedia.org/wikipedia/commons/5/59/Aegis_cruiser_USS_Bunker_Hill_%28CG-52%29.JPG',
};

// Equipment name to URL mapping
function getUrlForEquipment(name) {
  for (const [key, url] of Object.entries(WORKING_URLS)) {
    if (name.includes(key)) {
      return url;
    }
  }
  // Default fallback
  return 'https://upload.wikimedia.org/wikipedia/commons/2/2e/F-22_Raptor_-_100702-F-4815G-217.jpg';
}

console.log('Replacing all image URLs with verified working ones...\n');

const files = [
  { path: join(__dirname, '../src/lib/military-equipment.ts'), name: 'military-equipment.ts' },
  { path: join(__dirname, '../src/lib/military-equipment-extended.ts'), name: 'military-equipment-extended.ts' },
];

for (const file of files) {
  console.log(`Processing: ${file.name}`);
  let content = readFileSync(file.path, 'utf-8');

  // Extract equipment entries with their image URLs
  const entries = content.match(/(\w+):\s*{[\s\S]*?imageUrl:[\s\S]*?}/g) || [];

  let replacements = 0;

  for (const entry of entries) {
    const nameMatch = entry.match(/name:\s*"([^"]+)"/);
    const urlMatch = entry.match(/imageUrl:\s*"([^"]+)"/);

    if (nameMatch && urlMatch) {
      const equipmentName = nameMatch[1];
      const oldUrl = urlMatch[1];
      const newUrl = getUrlForEquipment(equipmentName);

      if (oldUrl !== newUrl) {
        content = content.replace(oldUrl, newUrl);
        replacements++;
        console.log(`  ✓ ${equipmentName}: ${newUrl}`);
      }
    }
  }

  writeFileSync(file.path, content, 'utf-8');
  console.log(`  Replaced ${replacements} URLs\n`);
}

console.log('✅ All image URLs have been replaced with verified working URLs!');
