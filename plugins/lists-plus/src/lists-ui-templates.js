// modules/lists/lists-ui-templates.js - UI Templates for Lists Module

class ListsUITemplates {
  static getPatternInputsHTML(type) {
    const templates = {
      grid: `
        <tr>
          <td>Grille</td>
          <td>
            <div class="input-with-arrows">
              <button class="arrow-btn-small" onclick="EnderTrack.Lists.adjustValue('pattern-cols', -1)">◀</button>
              <input type="number" id="pattern-cols" value="3" min="1" max="20" placeholder="X">
              <button class="arrow-btn-small" onclick="EnderTrack.Lists.adjustValue('pattern-cols', 1)">▶</button>
            </div>
          </td>
          <td>
            <div class="input-with-arrows">
              <button class="arrow-btn-small" onclick="EnderTrack.Lists.adjustValue('pattern-rows', -1)">◀</button>
              <input type="number" id="pattern-rows" value="3" min="1" max="20" placeholder="Y">
              <button class="arrow-btn-small" onclick="EnderTrack.Lists.adjustValue('pattern-rows', 1)">▶</button>
            </div>
          </td>
          <td></td>
        </tr>
        <tr>
          <td>Pas</td>
          <td><input type="number" id="pattern-stepx" value="5" step="0.1" placeholder="X"></td>
          <td><input type="number" id="pattern-stepy" value="5" step="0.1" placeholder="Y"></td>
          <td></td>
        </tr>
        <tr>
          <td>Balayage</td>
          <td colspan="2">
            <select id="pattern-sweep">
              <option value="normal">Normal</option>
              <option value="snake">Méandre</option>
              <option value="reverse">Normal inversé</option>
              <option value="snake-reverse">Méandre inversé</option>
              <option value="spiral-out">Spirale (centre→ext)</option>
              <option value="spiral-in">Spirale (ext→centre)</option>
              <option value="random">Aléatoire</option>
            </select>
          </td>
          <td></td>
        </tr>
      `,
      
      random: `
        <tr>
          <td>Points</td>
          <td>
            <div class="input-with-arrows">
              <button class="arrow-btn-small" onclick="EnderTrack.Lists.adjustValue('pattern-points', -1)">◀</button>
              <input type="number" id="pattern-points" value="10" min="1" max="100">
              <button class="arrow-btn-small" onclick="EnderTrack.Lists.adjustValue('pattern-points', 1)">▶</button>
            </div>
          </td>
          <td></td>
          <td></td>
        </tr>
        <tr>
          <td>Zone</td>
          <td><input type="number" id="pattern-width" value="20" step="0.1" placeholder="Largeur"></td>
          <td><input type="number" id="pattern-height" value="20" step="0.1" placeholder="Hauteur"></td>
          <td></td>
        </tr>
        <tr>
          <td>Ordre</td>
          <td colspan="2">
            <select id="pattern-order">
              <option value="random">Aléatoire</option>
              <option value="nearest">Plus proche</option>
            </select>
          </td>
          <td></td>
        </tr>
      `,
      
      spiral: `
        <tr>
          <td>Tours</td>
          <td>
            <div class="input-with-arrows">
              <button class="arrow-btn-small" onclick="EnderTrack.Lists.adjustValue('pattern-turns', -1)">◀</button>
              <input type="number" id="pattern-turns" value="3" min="1" max="10" placeholder="Nb tours">
              <button class="arrow-btn-small" onclick="EnderTrack.Lists.adjustValue('pattern-turns', 1)">▶</button>
            </div>
          </td>
          <td></td>
          <td></td>
        </tr>
        <tr>
          <td>Rayon</td>
          <td><input type="number" id="pattern-radius" value="15" step="0.1" placeholder="Rayon max"></td>
          <td></td>
          <td></td>
        </tr>
        <tr>
          <td>Points</td>
          <td>
            <div class="input-with-arrows">
              <button class="arrow-btn-small" onclick="EnderTrack.Lists.adjustValue('pattern-points', -1)">◀</button>
              <input type="number" id="pattern-points" value="30" min="5" max="100" placeholder="Points">
              <button class="arrow-btn-small" onclick="EnderTrack.Lists.adjustValue('pattern-points', 1)">▶</button>
            </div>
          </td>
          <td></td>
          <td></td>
        </tr>
        <tr>
          <td>Direction</td>
          <td colspan="2">
            <select id="pattern-direction">
              <option value="outward">Centre vers extérieur</option>
              <option value="inward">Extérieur vers centre</option>
            </select>
          </td>
          <td></td>
        </tr>
      `
    };
    
    return templates[type] || '';
  }
  
  static getPositionsTableHTML(positions) {
    if (!positions || positions.length === 0) return '';
    
    return `
      <table>
        <thead>
          <tr><th>#</th><th>Nom</th><th>X</th><th>Y</th><th>Z</th><th>Marqueur</th><th>↑</th><th>↓</th><th>🗑️</th></tr>
        </thead>
        <tbody>
          ${positions.map((pos, index) => {
            const markerType = pos.markerType || 'circle';
            const markerEmoji = pos.markerEmoji || '📍';
            return `
            <tr>
              <td>${index + 1}</td>
              <td><input type="text" value="${pos.name}" data-pos-id="${pos.id}" data-field="name" class="pos-edit"></td>
              <td><input type="number" value="${pos.x.toFixed(1)}" data-pos-id="${pos.id}" data-field="x" class="pos-edit coordinates" step="0.1"></td>
              <td><input type="number" value="${pos.y.toFixed(1)}" data-pos-id="${pos.id}" data-field="y" class="pos-edit coordinates" step="0.1"></td>
              <td><input type="number" value="${pos.z.toFixed(1)}" data-pos-id="${pos.id}" data-field="z" class="pos-edit coordinates" step="0.1"></td>
              <td>
                <select data-pos-id="${pos.id}" data-field="markerType" class="pos-edit" onchange="EnderTrack.Lists.updatePositionMarker('${pos.id}', this.value)" style="width: 70px; font-size: 11px;">
                  <option value="circle" ${markerType === 'circle' ? 'selected' : ''}>⚫ Point</option>
                  <option value="cross" ${markerType === 'cross' ? 'selected' : ''}>✖️ Croix</option>
                  <option value="emoji" ${markerType === 'emoji' ? 'selected' : ''}>😀 Emoji</option>
                </select>
                ${markerType === 'emoji' ? `<button onclick="EnderTrack.Lists.selectPositionEmoji('${pos.id}')" style="font-size: 14px; padding: 2px 6px; border: none; background: var(--container-bg); cursor: pointer; border-radius: 3px;">${markerEmoji}</button>` : ''}
              </td>
              <td><button class="btn-move-up" onclick="EnderTrack.Lists.movePositionUp('${pos.id}')" title="Monter">↑</button></td>
              <td><button class="btn-move-down" onclick="EnderTrack.Lists.movePositionDown('${pos.id}')" title="Descendre">↓</button></td>
              <td><button class="btn-delete-pos" onclick="EnderTrack.Lists.deletePositionFromModal('${pos.id}')" title="Supprimer">🗑️</button></td>
            </tr>
          `}).join('')}
        </tbody>
      </table>
    `;
  }

  static getListOptionsHTML(list) {
    return '';
  }
}

// Register globally
window.ListsUITemplates = ListsUITemplates;
