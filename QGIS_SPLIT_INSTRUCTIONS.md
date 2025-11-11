# How to Split Dateline Countries in QGIS - CORRECT METHOD

## The Right Tool: "Split Features" (Interactive Editing)

### Step-by-Step:

1. **Load the layer (if not already loaded)**:
   - Browser Panel → PostgreSQL → IxStats → public
   - Drag `map_layer_political_editing` to map

2. **Enable Editing Mode** ✏️:
   - Right-click the layer → **Toggle Editing**
   - OR: Click the pencil icon in toolbar
   - Layer name turns YELLOW when in edit mode

3. **Select the country to split**:
   - Click **Select Features** tool (toolbar)
   - Click on one of the dateline countries (e.g., Oyashima)
   - It will highlight

4. **Draw a splitting line**:
   - Find the **Split Features** tool (scissors ✂️ icon)
   - If you can't see it: **View** → **Toolbars** → Check ☑ **Digitizing Toolbar**
   - Click the Split Features tool
   - Draw a vertical line across the country at ~180° longitude
   - Right-click to finish the line
   - The geometry splits!

5. **Save the changes** 💾:
   - Click **Save Layer Edits** (floppy disk icon)
   - OR: Right-click layer → Save Layer Edits
   - Changes write to database immediately!

6. **Repeat for other countries**:
   - Select next country
   - Split with line
   - Save edits

---

## Alternative Method: Manual Geometry Editing

If the split tool isn't working well:

1. **Select the country**
2. Click **Vertex Tool** (node editing)
3. Move vertices to adjust the geometry manually
4. Create two separate polygons instead of one spanning polygon

---

## Alternative Alternative: Use SQL (Fastest!)

Since you know the geometries are problematic, let's just delete the wide-spanning ones and keep only the valid parts:

```bash
cd /ixwiki/public/projects/ixstats
PGPASSWORD=postgres psql -U postgres -h localhost -p 5433 -d ixstats << 'EOSQL'
-- Check current spans
SELECT 
  country_id,
  ogc_fid,
  ROUND((ST_XMax(geometry) - ST_XMin(geometry))::numeric, 1) as lon_span
FROM map_layer_political_editing
ORDER BY lon_span DESC;
EOSQL
```

If any have span > 180°, we can split them with SQL!

---

## Visual Guide to Tools

**Toolbar Icons You Need:**

- **Toggle Editing** (✏️ pencil) - Enable edit mode
- **Select Features** (mouse pointer) - Select what to edit  
- **Split Features** (✂️ scissors) - Draw line to split geometry
- **Save Layer Edits** (💾 floppy disk) - Save to database

If you don't see these, enable: **View** → **Toolbars** → ☑ **Digitizing Toolbar**

