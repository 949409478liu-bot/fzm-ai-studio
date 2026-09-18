# FZM Canvas Interaction Contract

Status: Phase 1 implementation contract  
Scope: `/v2` RunningHub-style shell with LibTV-style spatial canvas interactions.

## 1 Blank Canvas

- Double-click blank canvas opens the Add Node Catalog at the cursor's world coordinate.
- Right-click blank canvas opens the Canvas Context Menu with Add Node, Fit View, Select Tool, Hand Tool, Connect Tool and disabled Assets.
- Left-click blank canvas clears floating UI and selection through React Flow selection behavior.
- Mouse wheel zooms around the cursor using React Flow viewport APIs.
- Holding Space enables temporary Hand mode; releasing Space restores the previous mode.
- `F` fits all nodes with padding.

## 2 Mouse Modes

- Modes are `Select`, `Hand` and `Connect`.
- Shortcuts are `V`, `H` and `C`.
- Space temporarily overrides the current mode with Hand.
- Top and bottom tool state are synced from the V2 canvas store.

## 3 Nodes

- Select mode allows click selection, Shift multi-select, marquee selection and header-based node dragging.
- Inputs and textareas use `nodrag`/`nopan` and stop pointer propagation.
- Right-click node opens a Node Context Menu.
- Run and Re-run are shown disabled in Phase 1.
- Duplicate, Disconnect, Inspect and Delete are active.
- Inspect opens a lightweight popover, not a permanent inspector sidebar.

## 4 Edges

- Output handles are on the right; input handles are on the left.
- Handles are hidden by default and become visible on hover or selection.
- Output to input shows React Flow's live connection preview.
- Connection validation rejects self edges, duplicate edges and cycles before the edge is added.
- Edge selection uses React Flow selection. Delete/Backspace removes selected edges unless focus is in editable content.

## 5 Delete

- Delete and Backspace remove selected nodes/edges.
- If focus is inside input, textarea or contenteditable, Delete/Backspace is ignored by canvas deletion logic.

## 6 Duplicate

- Duplicate copies node type, data and size.
- Duplicate position is offset by 32px right/down.
- Runtime state, selection state and future job state are not copied.

## 7 Undo Redo

- Undo/Redo is implemented with V2 snapshot history.
- Covered operations include add node, delete node, move node, add edge, delete edge and duplicate.
- Shortcuts are Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z and Ctrl+Y.

## 8 Node Catalog

- Opened by double-click blank canvas, bottom-toolbar Add or context-menu Add Node.
- Phase 1 enabled nodes: Text, Image, Video and Group.
- Audio and Workflow are displayed as disabled future items.

## 9 Handle To Blank

- Dropping an output connection on blank canvas opens a minimal Create Connected menu.
- Enabled Phase 1 targets are Create Text, Create Image and Create Video.
- Selecting a target creates the node at the drop world coordinate and connects the source to it.

## 10 Visual Contract

- Canvas is full-screen and dark neutral, not pure black.
- Dot grid is subtle and spatial only.
- Topbar and bottom toolbar are floating, compact and low contrast.
- No permanent sidebars or bottom panels exist in Phase 1.
- Nodes prioritize content over chrome.
- Accent color is reserved for selected, focus and active connection states.

## 11 Phase 1 Limits

- Provider, Job, SQLite, Asset Pipeline, Daxiong, Timeline and Agent are not implemented.
- Placeholder UI must not imply real server persistence or provider availability.
