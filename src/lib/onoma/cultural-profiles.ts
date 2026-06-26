// src/lib/onoma/cultural-profiles.ts
// Onoma Lab — Cultural & Linguistic Seed Data

import { CulturalProfile, NameCategory } from "./types";

/**
 * Seed names representing different linguistic and cultural families.
 * Curated to train the Markov Chain to generate phone-consistent names.
 */
export const CULTURAL_PROFILES: Record<CulturalProfile, Record<NameCategory, string[]>> = {
  latin: {
    country: [
      "Hispania", "Gallia", "Italia", "Lusitania", "Britannia", "Mauritania", "Dacia",
      "Dalmatia", "Raetia", "Noricum", "Pannonia", "Thracia", "Galatia", "Cappadocia",
      "Cilicia", "Judea", "Aegyptus", "Cyrenaica", "Numidia", "Corsica", "Sardinia",
      "Sicilia", "Achaia", "Epirus", "Macedonia", "Mesopotamia", "Armenia", "Bithynia"
    ],
    city: [
      "Roma", "Mediolanum", "Lugdunum", "Carthago", "Byzantium", "Lutetia", "Florentia",
      "Pompeii", "Corduba", "Toletum", "Tarraco", "Caesaraugusta", "Emerita", "Olisipo",
      "Hispalis", "Massilia", "Genua", "Ravenna", "Verona", "Neapolis", "Syracusae",
      "Brundisium", "Tarentum", "Capua", "Ostia", "Beneventum", "Ariminum", "Bononia", "Aquileia"
    ],
    province: [
      "Tarraconensis", "Baetica", "Lusitania", "Narbonensis", "Aquitania", "Belgica",
      "Lugdunensis", "Campania", "Apulia", "Calabria", "Etruria", "Umbria", "Liguria",
      "Venetia", "Istria", "Emilia", "Flaminia", "Picenum", "Samnium", "Latium"
    ],
    geography: [
      "Vesuvius", "Aetna", "Olympus", "Apenninus", "Pyrenaeus", "Danubius", "Padus",
      "Tiberis", "Rhenus", "Rhodanus", "Tagus", "Durius", "Iberus", "Sequana", "Liger",
      "Garumna", "Anas", "Baetis", "Rubico", "Arnus", "Albis", "Viadus", "Vistula"
    ],
    person: [
      "Marcus", "Lucius", "Gaius", "Julius", "Tiberius", "Claudius", "Nero", "Augustus",
      "Trajanus", "Hadrianus", "Antoninus", "Aurelius", "Commodus", "Septimius", "Severus",
      "Caracalla", "Diocletianus", "Constantinus", "Valerius", "Cornelius", "Fabius", "Decimus",
      "Aulus", "Quintus", "Servius", "Spurius", "Publius", "Titus", "Gnaeus", "Lucretia", "Cornelia"
    ],
    dynasty: [
      "Julio-Claudian", "Flavian", "Antonine", "Severan", "Constantinian", "Valentinian",
      "Theodosian", "Justinian", "Heraclian", "Isaurian", "Macedonian", "Komnenian",
      "Angelan", "Palaiologan", "Tarquin", "Valerian", "Decian", "Aurelian"
    ],
    military: [
      "Legio Augusta", "Legio Rapax", "Legio Victrix", "Legio Ferrata", "Legio Fulminata",
      "Legio Gemina", "Legio Alaudae", "Legio Adiutrix", "Legio Fretensis", "Cohors Italica",
      "Ala Augusta", "Classis Misenensis", "Classis Ravennas", "Classis Britannica"
    ],
    organization: [
      "Senatus", "Comitia", "Pontifices", "Vestales", "Augures", "Decemviri", "Quindecimviri",
      "Collegium Aurificum", "Collegium Fabrorum", "Collegium Mercatorum", "Sodalitas"
    ],
    culture: [
      "Romanus", "Latinus", "Sabinus", "Etruscus", "Samnis", "Campanus", "Apulus", "Calaber",
      "Ligurius", "Venetus", "Galli", "Iberi", "Lusitani", "Daci", "Thracians", "Greeks"
    ],
    ship: [
      "Neptunus", "Minerva", "Diana", "Apollo", "Mars", "Bacchus", "Mercury", "Ceres",
      "Juno", "Jupiter", "Vulcanus", "Vesta", "Pluto", "Proserpina", "Hercules", "Victoria"
    ]
  },
  germanic: {
    country: [
      "Gotland", "Jutland", "Friesland", "Westphalia", "Bavaria", "Saxony", "Swabia",
      "Franconia", "Thuringia", "Holstein", "Pomerania", "Silesia", "Bohemia", "Austria",
      "Denmark", "Norway", "Sweden", "Iceland", "England", "Mercia", "Wessex", "Northumbria"
    ],
    city: [
      "Hamburg", "Bremen", "Cologne", "Munich", "Frankfurt", "Nuremberg", "Stuttgart",
      "Hanover", "Leipzig", "Dresden", "Berlin", "Vienna", "Salzburg", "Zurich", "Basel",
      "Bern", "Geneva", "Copenhagen", "Oslo", "Bergen", "Trondheim", "Stockholm", "Gothenburg",
      "Uppsala", "Visby", "Reykjavik", "Akureyri", "London", "York", "Winchester"
    ],
    province: [
      "Baden", "Bavaria", "Brandenburg", "Hesse", "Hanover", "Rhineland", "Westphalia",
      "Saxony", "Silesia", "Pomerania", "Thuringia", "Tyrol", "Styria", "Carinthia",
      "Flanders", "Zeeland", "Holland", "Utrecht", "Gelderland", "Frisia"
    ],
    geography: [
      "Rhine", "Elbe", "Danube", "Oder", "Vistula", "Weser", "Ems", "Main", "Neckar",
      "Moselle", "Inn", "Salzach", "Glomma", "Klaralven", "Dalalven", "Torne", "Vatnajokull",
      "Kebnekaise", "Galdhopiggen", "Brocken", "Feldberg", "Watzmann", "Zugspitze"
    ],
    person: [
      "Ragnar", "Bjorn", "Sigurd", "Harald", "Olaf", "Eric", "Leif", "Knut", "Ivar",
      "Rollo", "Thorstein", "Hakon", "Magnus", "Sven", "Gustav", "Adolf", "Wilhelm",
      "Friedrich", "Heinrich", "Ludwig", "Karl", "Otto", "Konrad", "Dietrich", "Siegfried",
      "Gunther", "Hagen", "Alboin", "Theodoric", "Clovis", "Freydis", "Gudrun", "Astrid"
    ],
    dynasty: [
      "Merovingian", "Carolingian", "Ottonian", "Salian", "Hohenstaufen", "Habsburg",
      "Wasa", "Bernadotte", "Hohenzollern", "Wittelsbach", "Wettin", "Oldenburg",
      "Hanover", "Windsor", "Plantagenet", "Tudor", "Stuart"
    ],
    military: [
      "Fyrd", "Huskarls", "Einherjar", "Landsknecht", "Reiter", "Gefolge", "Heer",
      "Wiking", "Varangian", "Hird", "Leidang", "Spathar", "Schiltron"
    ],
    organization: [
      "Althing", "Thing", "Guild", "Hansa", "Vehm", "Ritterorden", "Bund",
      "Zunft", "Gilde", "Gemeinschaft", "Orden", "Bruderschaft"
    ],
    culture: [
      "Goth", "Vandal", "Burgundian", "Frank", "Saxon", "Angle", "Jute", "Frisian",
      "Lombard", "Suebi", "Norse", "Dane", "Swede", "Norwegian", "German", "Dutch"
    ],
    ship: [
      "Drakkar", "Knarr", "Skeid", "Karve", "Snekkja", "Galeon", "Kogge", "Hulk",
      "Wasa", "Gjoa", "Fram", "Siri", "Freja", "Thor", "Odin", "Loki"
    ]
  },
  celtic: {
    country: [
      "Eire", "Alba", "Cymru", "Breizh", "Kernow", "Mannin", "Galatia", "Helvetia",
      "Noricum", "Belgica", "Caledonia", "Hibernia", "Cambria", "Armorica"
    ],
    city: [
      "Dublin", "Belfast", "Cork", "Galway", "Limerick", "Waterford", "Glasgow",
      "Edinburgh", "Aberdeen", "Dundee", "Inverness", "Cardiff", "Swansea", "Newport",
      "Bangor", "St Davids", "Rennes", "Brest", "Quimper", "Lorient", "Vannes",
      "Saint-Malo", "Douglas", "Peel", "Ramsey", "Castletown"
    ],
    province: [
      "Leinster", "Munster", "Connacht", "Ulster", "Gwynedd", "Powys", "Dyfed",
      "Gwent", "Glamorgan", "Cornwall", "Brittany", "Lothian", "Fife", "Argyll"
    ],
    geography: [
      "Shannon", "Liffey", "Boyne", "Blackwater", "Suir", "Nore", "Barrow", "Foyle",
      "Clyde", "Tay", "Forth", "Spey", "Dee", "Don", "Ness", "Severn", "Thames",
      "Wye", "Trent", "Ouse", "Snowdon", "Ben Nevis", "Carrauntoohil"
    ],
    person: [
      "Connor", "Cuchulainn", "Fingal", "Ossian", "Brian", "Cormac", "Diarmuid", "Lugh",
      "Nuada", "Angus", "Donald", "Duncan", "Malcolm", "Kenneth", "Alpin", "Arthur",
      "Merlin", "Gawain", "Galahad", "Tristan", "Lancelot", "Geraint", "Percival", "Kay",
      "Bedivere", "Uther", "Pendragon", "Vortigern", "Boudica", "Caratacus"
    ],
    dynasty: [
      "O'Connor", "O'Neill", "O'Brien", "McCarthy", "McDonald", "Campbell", "Stewart",
      "Tudor", "Gwynedd", "Aberffraw", "Dinefwr", "Mathrafal"
    ],
    military: [
      "Gallowglass", "Kern", "Fianna", "Teulu", "Clanna", "Celts", "Picts", "Gauls",
      "Helvetians", "Galatians"
    ],
    organization: [
      "Druids", "Bards", "Ovate", "Clan", "Tuath", "Fine", "Senechus", "Brehon",
      "Gorsedd", "Eisteddfod"
    ],
    culture: [
      "Gael", "Briton", "Pict", "Gaul", "Breton", "Cornish", "Manx", "Welsh",
      "Irish", "Scottish", "Belgae", "Helvetii"
    ],
    ship: [
      "Currach", "Coracle", "Birlinn", "Galley", "Fingal", "Lugh", "Bran",
      "Cuchulainn", "Danu", "Dagda", "Morrigan", "Aengus"
    ]
  },
  slavic: {
    country: [
      "Rossiya", "Ukraina", "Belarus", "Polsha", "Chekhiya", "Slovakiya", "Sloveniya",
      "Khorvatiya", "Bosniya", "Serbiya", "Chernogoriya", "Makedoniya", "Bulgariya",
      "Moravia", "Silesia", "Ruthenia", "Galicia", "Volhynia", "Pomerania"
    ],
    city: [
      "Moskva", "Kiev", "Minsk", "Varshava", "Praga", "Bratislava", "Ljubljana",
      "Zagreb", "Sarajevo", "Beograd", "Podgorica", "Skopje", "Sofiya", "Novgorod",
      "Vladimir", "Suzdal", "Yaroslavl", "Kostroma", "Nizhny", "Kazan", "Samara",
      "Saratov", "Volgograd", "Rostov", "Krasnodar", "Sochi", "Sevastopol", "Odessa",
      "Kharkov", "Lvov", "Gdansk", "Krakow", "Wroclaw", "Poznan"
    ],
    province: [
      "Mazovia", "Silesia", "Pomerania", "Galicia", "Podolia", "Volhynia", "Transcarpathia",
      "Dalmatia", "Istria", "Slavonia", "Vojvodina", "Kosovo", "Sandzak", "Thrace",
      "Macedonia", "Dobruja", "Krajina", "Lesser Poland", "Greater Poland"
    ],
    geography: [
      "Volga", "Dnepr", "Don", "Dnestr", "Vistula", "Oder", "Elbe", "Danube", "Ural",
      "Ob", "Yenisey", "Lena", "Amur", "Baikal", "Ladoga", "Onega", "Ilmen", "Peipus",
      "Carpathian", "Balkan", "Tatra", "Sudeten", "Caucasus"
    ],
    person: [
      "Vladimir", "Yaroslav", "Svyatoslav", "Mstislav", "Vsevolod", "Rostislav", "Vyacheslav",
      "Boleslav", "Vladislav", "Stanislav", "Bronislav", "Miroslav", "Dobromir", "Radomir",
      "Casimir", "Rurik", "Oleg", "Igor", "Gleb", "Boris", "Dmitry", "Ivan", "Peter",
      "Alexei", "Mikhail", "Nikolai", "Alexander", "Sergei", "Yuri", "Andrey", "Olga", "Ludmila"
    ],
    dynasty: [
      "Rurikid", "Romanov", "Piast", "Jagiellonian", "Premyslid", "Arpad", "Nemanjić",
      "Obrenović", "Karadjordjević", "Kotromanić", "Trpimirović"
    ],
    military: [
      "Druzhina", "Streltsy", "Cossacks", "Hussars", "Bogatyrs", "Voivode", "Opolcheniye",
      "Pulk", "Sotnia", "Zaporozhians", "Heyduks"
    ],
    organization: [
      "Veche", "Boyar Duma", "Sabor", "Sejm", "Rada", "Zemstvo", "Mir", "Obschina",
      "Sobor", "Chetniks", "Partizani"
    ],
    culture: [
      "Russian", "Ukrainian", "Belarusian", "Pole", "Czech", "Slovak", "Slovene",
      "Croat", "Serb", "Bosniak", "Bulgarian", "Macedonian", "Moravian", "Sorbs"
    ],
    ship: [
      "Ladya", "Chaika", "Koch", "Struga", "Aurora", "Potemkin", "Varyag", "Novgorod",
      "Rurik", "Svyatoslav", "Vladimir", "Alexander"
    ]
  },
  arabic: {
    country: [
      "Misr", "Iraq", "Suriyah", "Lubnan", "Filastin", "Urdun", "Hijaz", "Nejd",
      "Yaman", "Oman", "Imarat", "Qatar", "Bahrain", "Kuwait", "Sudan", "Libya",
      "Tunis", "Jazair", "Maghrib", "Mauritanya", "Somalia", "Djibouti"
    ],
    city: [
      "Baghdad", "Dimashq", "Halab", "Beirut", "Quds", "Amman", "Makkah", "Madinah",
      "Riyadh", "Jeddah", "Sanaa", "Aden", "Muscat", "Abu Dhabi", "Dubai", "Doha",
      "Manama", "Kuwait City", "Khartum", "Tripoli", "Tunis", "Algiers", "Rabat",
      "Casablanca", "Marrakech", "Fez", "Cairo", "Alexandria", "Giza", "Port Said"
    ],
    province: [
      "Hijaz", "Nejd", "Hadramaut", "Asir", "Al-Ahsa", "Barqa", "Tripolitania", "Fezzan",
      "Rif", "Souss", "Tafilalet", "Sinai", "Gaza", "West Bank", "Galilee", "Golans",
      "Khuzestan", "Dhofar"
    ],
    geography: [
      "Nile", "Euphrates", "Tigris", "Jordan", "Orontes", "Litani", "Yarmouk", "Red Sea",
      "Persian Gulf", "Gulf of Aden", "Sinai", "Atlas Mountains", "Hijaz Mountains", "Hadramaut",
      "Rub' al Khali", "Sahara", "Nefud", "Qattara", "Dead Sea", "Lake Nasser"
    ],
    person: [
      "Muhammad", "Ahmed", "Mahmoud", "Mustafa", "Ali", "Hassan", "Hussein", "Ibrahim",
      "Ismail", "Yusuf", "Musa", "Isa", "Suleiman", "Dawud", "Harun", "Yahya", "Zakariya",
      "Ayyub", "Yunus", "Idris", "Nuh", "Hud", "Salih", "Shuaib", "Luqman", "Al-Amin",
      "Al-Mansur", "Harun al-Rashid", "Saladin", "Baibars", "Fatima", "Aisha", "Khadija"
    ],
    dynasty: [
      "Umayyad", "Abbasid", "Fatimid", "Ayyubid", "Mamluk", "Ottoman", "Almoravid",
      "Almohad", "Saadi", "Alaouite", "Hashemite", "Saud", "Al-Sabah", "Al-Nahyan",
      "Al-Thani", "Idrisid", "Tulunid", "Ikhshidid"
    ],
    military: [
      "Jund", "Mamluks", "Janissaries", "Sipahi", "Mujahideen", "Fedayeen", "Ansar",
      "Ghazis", "Askars"
    ],
    organization: [
      "Caliphate", "Sultanate", "Emirate", "Divan", "Shura", "Waqf", "Madrasa",
      "Caravanserai", "Harem", "Bazaar", "Souk"
    ],
    culture: [
      "Arab", "Bedouin", "Egyptian", "Syrian", "Iraqi", "Yemeni", "Moor", "Berber",
      "Tuareg", "Nubian", "Levantine", "Maghrebi"
    ],
    ship: [
      "Dhow", "Sambuq", "Baghla", "Ghanjah", "Jalibut", "Bum", "Shu'ai", "Zarook",
      "Fattah", "Salamat", "Mansur", "Mubarak"
    ]
  },
  "east-asian": {
    country: [
      "Zhongguo", "Riben", "Chaoxian", "Hanguo", "Menggu", "Yuenan", "Taiwan",
      "Ryukyu", "Tibet", "Manchuria", "Sinkiang"
    ],
    city: [
      "Beijing", "Shanghai", "Guangzhou", "Shenzhen", "Tianjin", "Wuhan", "Chengdu",
      "Chongqing", "Xian", "Nanjing", "Tokyo", "Osaka", "Kyoto", "Nagoya", "Yokohama",
      "Kobe", "Fukuoka", "Sapporo", "Seoul", "Busan", "Incheon", "Daegu", "Daejeon",
      "Gwangju", "Ulsan", "Pyongyang", "Nampo", "Kaesong", "Hanoi", "Saigon",
      "Da Nang", "Hue", "Haiphong", "Ulaanbaatar"
    ],
    province: [
      "Guangdong", "Sichuan", "Shandong", "Jiangsu", "Henan", "Hebei", "Zhejiang",
      "Hunan", "Hubei", "Fujian", "Kanto", "Kansai", "Chubu", "Tohoku", "Chugoku",
      "Kyushu", "Shikoku", "Hokkaido", "Gyeonggi", "Gangwon", "Chungcheong", "Jeolla",
      "Gyeongsang", "Jeju"
    ],
    geography: [
      "Yangtze", "Yellow River", "Pearl River", "Amur", "Mekong", "Red River", "Mount Fuji",
      "Mount Tai", "Mount Huang", "Mount Hua", "Mount Song", "Mount Heng", "Lake Biwa",
      "Lake Poyang", "Lake Dongting", "Lake Tai", "Lake Khanka", "Sea of Japan", "East China Sea",
      "South China Sea", "Yellow Sea"
    ],
    person: [
      "Kangxi", "Qianlong", "Yongzheng", "Taizong", "Xuanzong", "Kublai", "Genghis",
      "Oda Nobunaga", "Toyotomi Hideyoshi", "Tokugawa Ieyasu", "Minamoto Yoritomo",
      "Taira Kiyomori", "Sejong", "Taejo", "Gwanggaeto", "Le Loi", "Ly Thai To", "Tran Hung Dao",
      "Nguyen Hue", "Zhuge Liang", "Cao Cao", "Liu Bei", "Sun Quan", "Li Bai", "Du Fu"
    ],
    dynasty: [
      "Han", "Tang", "Song", "Yuan", "Ming", "Qing", "Yamato", "Kamakura", "Muromachi",
      "Edo", "Joseon", "Goryeo", "Silla", "Baekje", "Goguryeo", "Le", "Ly", "Tran", "Nguyen"
    ],
    military: [
      "Samurai", "Ashigaru", "Ninja", "Monks", "Sohei", "Bannermen", "Hwarang",
      "Red Turbans", "Yellow Turbans", "Taiping", "Boxers"
    ],
    organization: [
      "Shogunate", "Bakufu", "Yamen", "Zongli Yamen", "Censorate", "Tongs", "Triads",
      "Zaibatsu", "Chaebol"
    ],
    culture: [
      "Han", "Manchu", "Mongol", "Tibetan", "Hui", "Uighur", "Japanese", "Korean",
      "Vietnamese", "Ryukyuan", "Ainu", "Zhuang"
    ],
    ship: [
      "Junk", "Atakebune", "Sengokubune", "Kobaya", "Turtle Ship", "Panokseon",
      "Treasure Ship", "Louchuan", "Mengchong", "Donghai", "Nanhai"
    ]
  },
  austronesian: {
    country: [
      "Indonesia", "Malaysia", "Pilipinas", "Brunei", "Timor", "Madagaskar", "Taiwan",
      "Hawaii", "Samoa", "Tonga", "Fiji", "Tahiti", "Aotearoa", "Tuvalu", "Kiribati",
      "Nauru", "Vanuatu", "Solomons", "Micronesia", "Palau", "Guam"
    ],
    city: [
      "Jakarta", "Surabaya", "Bandung", "Medan", "Palembang", "Makassar", "Denpasar",
      "Kuala Lumpur", "Penang", "Ipoh", "Melaka", "Kota Kinabalu", "Kuching", "Manila",
      "Cebu", "Davao", "Quezon City", "Zamboanga", "Bandar Seri Begawan", "Dili",
      "Antananarivo", "Taipei", "Honolulu", "Hilo", "Apia", "Nuku'alofa", "Suva",
      "Papeete", "Wellington", "Auckland", "Christchurch", "Hamilton"
    ],
    province: [
      "Jawa", "Sumatera", "Kalimantan", "Sulawesi", "Papua", "Selangor", "Johor",
      "Perak", "Kedah", "Kelantan", "Terengganu", "Pahang", "Negri Sembilan", "Luzon",
      "Visayas", "Mindanao", "Oahu", "Maui", "Kauai", "Tahiti", "Bora Bora"
    ],
    geography: [
      "Toba", "Batur", "Rinjani", "Semeru", "Merapi", "Bromo", "Krakatoa", "Tambora",
      "Kinabalu", "Apo", "Mayon", "Taal", "Pulag", "Mauna Loa", "Mauna Kea", "Kilauea",
      "Haleakala", "Orohena", "Aoraki", "Ruapehu", "Tongariro", "Tarawera"
    ],
    person: [
      "Gajah Mada", "Hayam Wuruk", "Raden Wijaya", "Parameswara", "Hang Tuah", "Lapu-Lapu",
      "Jose Rizal", "Andres Bonifacio", "Emilio Aguinaldo", "Kamehameha", "Kalakaua",
      "Liliuokalani", "Pomare", "Tamatoa", "Tu'i Tonga", "Malietoa", "Te Rauparaha",
      "Hone Heke", "Potatau", "Rata", "Kupe", "Maui", "Lono", "Pele"
    ],
    dynasty: [
      "Majapahit", "Sriwijaya", "Sailendra", "Sanjaya", "Singhasari", "Kediri", "Mataram",
      "Melaka", "Brunei", "Sulu", "Kamehameha", "Kalakaua", "Pomare", "Tu'i Tonga"
    ],
    military: [
      "Bolo", "Panglima", "Kris", "Silat", "Haka", "Toa", "Warrior", "Navigators",
      "Outriggers"
    ],
    organization: [
      "Adat", "Kampung", "Barangay", "Datu", "Raja", "Ali'i", "Kahuna", "Marae",
      "Hula", "Kava", "Luau"
    ],
    culture: [
      "Malay", "Javanese", "Sundanese", "Balinese", "Filipino", "Tagalog", "Ilocano",
      "Visayan", "Moro", "Malagasy", "Hawaiian", "Samoan", "Tongan", "Fijian", "Tahitian", "Maori"
    ],
    ship: [
      "Outrigger", "Waka", "Canoe", "Pinisi", "Lantaka", "Proa", "Karakoa", "Prahu",
      "Kanoa", "Wa'a", "Hokule'a"
    ]
  },
  constructed: {
    country: [
      "Gondor", "Rohan", "Arnor", "Lothlorien", "Rivendell", "Mordor", "Isengard",
      "Harad", "Umbar", "Rhun", "Valinor", "Numenor", "Beleriand", "Doriath",
      "Nargothrond", "Gondolin", "Khazad-dum", "Erebor", "Angmar", "Cardolan"
    ],
    city: [
      "Minas Tirith", "Minas Morgul", "Osgiliath", "Edoras", "Helms Deep", "Bree",
      "Hobbiton", "Rivendell", "Caras Galadhon", "Barad-dur", "Orthanc", "Umbar",
      "Esgaroth", "Dale", "Fornost", "Tharbad", "Annuminas", "Avallone", "Tirion", "Valmar"
    ],
    province: [
      "Anfalas", "Belfalas", "Ithilien", "Lebennin", "Lossarnach", "Anorien",
      "Westfold", "Eastfold", "Folde", "Dorwinion", "Enedwaith", "Minhiriath",
      "Rhudaur", "Arthedain", "Dor-lomin", "Hithlum", "Ladros"
    ],
    geography: [
      "Anduin", "Brandywine", "Bruinen", "Sirion", "Gelion", "Narog", "Teiglin",
      "Mindolluin", "Caradhras", "Celebdil", "Fanuidhol", "Orodruin", "Ephel Duath",
      "Ered Lithui", "Ered Luin", "Blue Mountains", "Misty Mountains", "White Mountains",
      "Sea of Nurn", "Sea of Helcar"
    ],
    person: [
      "Aragorn", "Legolas", "Gimli", "Gandalf", "Frodo", "Samwise", "Pippin", "Merry",
      "Boromir", "Faramir", "Denethor", "Theoden", "Eomer", "Eowyn", "Elrond", "Arwen",
      "Galadriel", "Celeborn", "Thranduil", "Sauron", "Saruman", "Morgoth", "Feanor",
      "Fingolfin", "Finarfin", "Thingol", "Luthien", "Beren", "Turin", "Tuor"
    ],
    dynasty: [
      "Elendil", "Anarion", "Isildur", "House of Hurin", "House of Hador", "House of Haleth",
      "House of Beor", "Eorlingas", "Durin", "Feanorians", "Finwe"
    ],
    military: [
      "Rangers", "Rohirrim", "Guard of the Fountain", "Uruk-hai", "Nazgul", "Olog-hai",
      "Easterlings", "Haradrim", "Corsairs", "Ork-host"
    ],
    organization: [
      "White Council", "Istari", "Council of Elrond", "Mithril-smiths", "Dunedain",
      "Fellowship", "Beornings", "Ents"
    ],
    culture: [
      "Dunadan", "Sindar", "Noldor", "Vanyar", "Teleri", "Eldar", "Silvan", "Avari",
      "Khazad", "Hobbit", "Orc", "Troll", "Easterling", "Haradrim"
    ],
    ship: [
      "Earendil", "Vingilot", "Alqualonde", "Swan-ship", "Numenorean", "Corsair",
      "Grey Havens", "Cirdan"
    ]
  }
};
