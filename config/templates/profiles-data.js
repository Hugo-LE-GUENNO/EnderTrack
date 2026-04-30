// Données des profils - chargées directement sans fetch
window.ProfilesData = {
  main: [
    {
      "id": "ender2",
      "name": "Creality Ender-2",
      "brand": "Creality",
      "dimensions": { "x": 150, "y": 150, "z": 200 },
      "coordinateBounds": {
        "x": { "min": 0, "max": 150 },
        "y": { "min": 0, "max": 150 },
        "z": { "min": 0, "max": 200 }
      },
      "axisOrientation": { "x": "right", "y": "down", "z": "up" },
      "description": "Imprimante 3D compacte et abordable",
      "gcode": true
    },
    {
      "id": "ender3",
      "name": "Creality Ender-3",
      "brand": "Creality",
      "dimensions": { "x": 220, "y": 220, "z": 250 },
      "coordinateBounds": {
        "x": { "min": 0, "max": 220 },
        "y": { "min": 0, "max": 220 },
        "z": { "min": 0, "max": 250 }
      },
      "axisOrientation": { "x": "right", "y": "down", "z": "up" },
      "description": "Imprimante 3D populaire et polyvalente",
      "gcode": true
    },
    {
      "id": "ender3_v2",
      "name": "Creality Ender-3 V2",
      "brand": "Creality",
      "dimensions": { "x": 220, "y": 220, "z": 250 },
      "coordinateBounds": {
        "x": { "min": 0, "max": 220 },
        "y": { "min": 0, "max": 220 },
        "z": { "min": 0, "max": 250 }
      },
      "axisOrientation": { "x": "right", "y": "down", "z": "up" },
      "description": "Ender-3 avec écran couleur et améliorations",
      "gcode": true
    },
    {
      "id": "prusa_mk3s",
      "name": "Prusa i3 MK3S+",
      "brand": "Prusa Research",
      "dimensions": { "x": 250, "y": 210, "z": 210 },
      "coordinateBounds": {
        "x": { "min": 0, "max": 250 },
        "y": { "min": 0, "max": 210 },
        "z": { "min": 0, "max": 210 }
      },
      "axisOrientation": { "x": "right", "y": "down", "z": "up" },
      "description": "Référence en qualité d'impression",
      "gcode": true
    },
    {
      "id": "bambu_x1_carbon",
      "name": "Bambu Lab X1 Carbon",
      "brand": "Bambu Lab",
      "dimensions": { "x": 256, "y": 256, "z": 256 },
      "coordinateBounds": {
        "x": { "min": 0, "max": 256 },
        "y": { "min": 0, "max": 256 },
        "z": { "min": 0, "max": 256 }
      },
      "axisOrientation": { "x": "right", "y": "down", "z": "up" },
      "description": "Imprimante haut de gamme ultra-rapide",
      "gcode": false
    },
    {
      "id": "microscope_stage",
      "name": "Stage Microscope Standard",
      "brand": "Laboratory",
      "dimensions": { "x": 100, "y": 100, "z": 50 },
      "coordinateBounds": {
        "x": { "min": -50, "max": 50 },
        "y": { "min": -50, "max": 50 },
        "z": { "min": -25, "max": 25 }
      },
      "axisOrientation": { "x": "right", "y": "up", "z": "up" },
      "description": "Stage motorisé pour microscope de laboratoire",
      "gcode": true
    }
  ],
  
  enderscope: [
    {
      "id": "enderscope_v1",
      "name": "Enderscope V1",
      "brand": "Enderscope",
      "dimensions": { "x": 150, "y": 150, "z": 100 },
      "coordinateBounds": {
        "x": { "min": -75, "max": 75 },
        "y": { "min": -75, "max": 75 },
        "z": { "min": 0, "max": 100 }
      },
      "axisOrientation": { "x": "right", "y": "up", "z": "up" },
      "description": "Microscope automatisé Enderscope V1",
      "customCategory": "Enderscope",
      "gcode": true
    }
  ]
};