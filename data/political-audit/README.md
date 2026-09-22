# IxStates — Political Spectrum & Governance Lore Data Dumps

This directory contains the authoritative data dumps and entity extractions gathered from both the direct **MediaWiki database** (MariaDB `ixwiki`, port 13306) and the **PostgreSQL database** (`ixstats`, port 5433).

These dumps serve as the empirical foundation for understanding the political landscape across Ixnay, establishing setting-native axes grounded directly in the corpus of the entire wiki without relying on legacy real-world labels.

---

## 📁 Dataset Catalog

| File | Size | Source | Description |
| :--- | :--- | :--- | :--- |
| [`POLITICAL_SPECTRUM_FRAMEWORKS.md`](POLITICAL_SPECTRUM_FRAMEWORKS.md) | 12 KB | Synthesis Spec | **Political Spectrum Frameworks & Comparative Models**: Comprehensive political theory specification detailing the 3 evaluated models (Compass, Dialectic, Triad) with full empirical country placements. |
| [`category_countries_government_audit.json`](category_countries_government_audit.json) | 684 KB | MariaDB `ixwiki` | **Category:Countries Governance Audit**: Complete crawl across all **304 country subcategories**, auditing 3,522 total articles with focused extraction on 374 governance, government, and constitutional articles. |
| [`country_governance_profiles.json`](country_governance_profiles.json) | 204 KB | MariaDB `ixwiki` | Structured governance dossiers for nations across all 6 continents, linking main country articles, Government of X, Politics of X, Constitutions, and Legislatures. |
| [`category_politics_full_audit.json`](category_politics_full_audit.json) | 1.07 MB | MariaDB `ixwiki` | **Authoritative Category:Politics Audit**: Full recursive BFS crawl across `Category:Politics` (48 subcategories) + related country politics/government trees (70 total categories). Covers 688 articles with zlib `inflateRaw` text decompression. |
| [`category_politics_entities.json`](category_politics_entities.json) | 188 KB | MariaDB `ixwiki` | Structured extraction of **56 political parties**, **28 distinct political ideologies**, and **66 governments & constitutions** under `Category:Politics` and country governance categories. |
| [`entire_wiki_deep_dive.txt`](entire_wiki_deep_dive.txt) | 147 KB | MariaDB `ixwiki` | Complete corpus-wide analysis across all **4,725 non-redirect articles**, auditing 293 country profiles, 97 parties, 31 philosophies across all 6 continents. |
| [`entire_wiki_political_entities.json`](entire_wiki_political_entities.json) | 652 KB | MariaDB `ixwiki` | Corpus-wide extraction of parties, ideologies, and governance models across Coscivia, Levantia, Crona, Orient, Audonia, and Sarpedon. |
| [`entire_wiki_spectrum_stats.json`](entire_wiki_spectrum_stats.json) | 91 KB | MariaDB `ixwiki` | Global vocabulary distribution, continent counts, and term co-occurrence across all 4,725 articles. |
| [`full_political_audit.json`](full_political_audit.json) | 4.34 MB | MariaDB `ixwiki` | Complete crawl of **3,573 articles** across `Category:Government`, `Category:Politics`, `Category:Political_ideologies`, and `Category:Countries`. |
| [`political_spectrum_audit.json`](political_spectrum_audit.json) | 816 KB | MariaDB + PG | Deep statistical audit of 3,575 articles, 328 country profiles, 119 parties, 32 ideology articles, 192 unique political terms, and 668 co-occurrence pairs. |
| [`political_entities.json`](political_entities.json) | 212 KB | MariaDB `ixwiki` | Structured extraction of **90 political parties** and **16 core ideology articles**. |
| [`pg_countries_audit.json`](pg_countries_audit.json) | 93 KB | PostgreSQL | Full snapshot of all 200+ countries from the `Country` table including `governmentType`, `governmentStructure`, legislative branches, and leaders. |
| [`pg_wiki_articles_audit.json`](pg_wiki_articles_audit.json) | 81 KB | PostgreSQL | WikiOS native `WikiArticle` table dump matching political keywords, constitutions, parties, and governance forms. |
| [`wikios_political_audit.json`](wikios_political_audit.json) | 58 KB | PostgreSQL | WikiOS `WikiCategory` & `WikiCategoryMember` relational tree crawl for political classifications. |
| [`target_ideologies_full.txt`](target_ideologies_full.txt) | 34 KB | MariaDB `ixwiki` | Full wikitext extracts of hallmark ideologies and parties (Organicism, Crown Liberalism, Nolanism, Urcean socialism, Foralism, Commarcho-Capitalism, Velvetine Socialism, Kirosocialism, Shaftonist democracy, Adaptivism, Bairdism, etc.). |
| [`key_governance_profiles.txt`](key_governance_profiles.txt) | 16 KB | MariaDB `ixwiki` | Detailed governance profiles for major powers: Urcea, Caphiria, Cartadania, Burgundie, Yonderre, Faneria, Kiravia, Thervala, Daxia, and Pelaxia. |
| [`analysis_out.txt`](analysis_out.txt) | 8.1 KB | Parser script | Frequency counts of traditional vs. native political terminology in article intros, ideology article inventory, and parties grouped by country. |
| [`pg_govs_out.txt`](pg_govs_out.txt) | 8.8 KB | PostgreSQL | PostgreSQL `governmentType` frequency breakdown and executive/legislative branch compositions. |
| [`parties_out.txt`](parties_out.txt) | 7.2 KB | PostgreSQL | Roster of all `PoliticalParty` records with country, name, ideology enum, platform notes, and base support percentage. |
| [`deep_terms_out.txt`](deep_terms_out.txt) | 7.2 KB | MariaDB `ixwiki` | Contextual text excerpts for core philosophical terms: *Organicism*, *Quaternalism*, *Societates Dominanae*, *Synodalism*, *Shaftonist democracy*, *Kirosocialism*. |
| [`caph_read_out.txt`](caph_read_out.txt) | 5.3 KB | MariaDB `ixwiki` | Text extracts on the Caphirian Imperium, Senate of Caphiria, and the Vestiary Laws. |
| [`caph_carta_out.txt`](caph_carta_out.txt) | 2.0 KB | MariaDB `ixwiki` | Index of political and constitutional articles for Caphiria and Cartadania. |
| [`gov_types_out.txt`](gov_types_out.txt) | 385 B | MariaDB `ixwiki` | Extracted `government_type` parameters from Infobox country templates. |
| [`db_check.txt`](db_check.txt) | 2.7 KB | Diagnostics | Database connection verification and schema inventory for MariaDB and PostgreSQL. |
| [`full_audit_run.txt`](full_audit_run.txt) | 782 B | Execution Log | Log output from the 3,573-article extraction run against MariaDB. |

---

## 🛠️ Extraction Scripts (`scripts/`)

The executable TypeScript scripts that generated these datasets are located in [`scripts/`](scripts/):

- `audit-category-politics-authoritative.ts`: Authoritative recursive BFS across `Category:Politics` (48 subcats) and country governance trees with zlib `inflateRaw` text decompression.
- `audit-full-corpus-4725.ts`: Comprehensive full-corpus audit across all 4,725 non-redirect articles in MariaDB.
- `full-political-audit.ts`: Initial category crawl across Category:Government, Category:Politics, Category:Political_ideologies, and Category:Countries.
- `audit-political-lore.ts`: Traverses PostgreSQL `WikiCategory` and `WikiCategoryMember` hierarchies.
- `analyze-audit.ts`: Analyzes entity counts, country clustering, and terminology frequency.
- `dump-ideologies.ts`: Filters and extracts full wikitext for target ideologies.
- `inspect-gov-profiles.ts`: Extracts constitution and government structure sections for Tier-1 nations.
- `analyze-pg-govs.ts`: Audits PostgreSQL `Country` and `GovernmentStructure` relations.
- `analyze-parties.ts`: Extracts all `PoliticalParty` table rows.
- `deep-terms.ts`: Keyword search engine across the wikitext corpus.
