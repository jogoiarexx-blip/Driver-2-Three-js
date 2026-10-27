        /**
         * ============================================================================
         * PRESETS DAS 4 CIDADES CLÁSSICAS DO DRIVER 2
         * ============================================================================
         */
        const CITY_PRESETS = {
            chicago: {
                id: 'chicago',
                name: 'CHICAGO',
                // Chicago: ar azul-acinzentado, tijolos ferrugem,
                // arranha-céus de pedra/aço e água profunda.
                skyColor: 0x475a70,
                sunColor: 0xffddb2,
                waterColor: 0x1e566e,
                parkColor: 0x205c40,
                palettes: [
                    { wall: '#4a5e70', win: '#f3d6a4' },
                    { wall: '#6d7680', win: '#a7c8d8' },
                    { wall: '#784c3e', win: '#dfb58a' },
                    { wall: '#293d50', win: '#e6c08a' }
                ],
                playerCarName: 'BUICK 70 V8',
                playerCarColor: 0xd97706,
                copName: 'CHICAGO PD',
                copColor: 0x0f172a,
                secretCarName: 'WRIGLEY SUPER V8',
                secretCarColor: 0x9333ea
            },
            havana: {
                id: 'havana',
                name: 'HAVANA',
                // Fachadas desbotadas pela maresia, pedra colonial,
                // cores pastéis e pôr do sol dourado menos saturado.
                skyColor: 0xd38c70,
                sunColor: 0xffd6a0,
                waterColor: 0x1388a0,
                parkColor: 0x237449,
                palettes: [
                    { wall: '#d8b18c', win: '#a4c5c6' },
                    { wall: '#c88d84', win: '#f5e0c4' },
                    { wall: '#8cb6a6', win: '#f7e6c7' },
                    { wall: '#e0c6a2', win: '#6f9caa' }
                ],
                playerCarName: 'HAVANA CRUISER 57',
                playerCarColor: 0x0284c7,
                copName: 'POLICIA HAVANA',
                copColor: 0x14532d,
                secretCarName: 'HAVANA MINI ROSA',
                secretCarColor: 0xf472b6
            },
            vegas: {
                id: 'vegas',
                name: 'LAS VEGAS',
                // Céu azul-índigo: contraste legível com letreiros
                // neon, hotéis em concreto/vidro e deserto ao fundo.
                skyColor: 0x1a1935,
                sunColor: 0xcac0f0,
                waterColor: 0x242047,
                parkColor: 0x735e43, // Jardins e deserto de Nevada
                palettes: [
                    { wall: '#52566b', win: '#ffcc80' },
                    { wall: '#504364', win: '#76c9e4' },
                    { wall: '#3b455d', win: '#f2a5d1' },
                    { wall: '#716071', win: '#a8e5bc' }
                ],
                playerCarName: 'VEGAS COUGAR V8',
                playerCarColor: 0xdc2626,
                copName: 'LVMPD INTERCEPTOR',
                copColor: 0x18181b,
                secretCarName: 'STRIP NITRO ROD',
                secretCarColor: 0x22d3ee
            },
            rio: {
                id: 'rio',
                name: 'RIO DE JANEIRO',
                // Orla de dia: azul menos saturado, luz quente,
                // prédios de cerâmica branca, pastel e concreto.
                skyColor: 0x60b7dd,
                sunColor: 0xffe0ad,
                waterColor: 0x087b9c,
                parkColor: 0x20764d,
                palettes: [
                    { wall: '#d5ded7', win: '#7eb9ce' },
                    { wall: '#d8b99b', win: '#f6f0db' },
                    { wall: '#9ab6b7', win: '#dbe7df' },
                    { wall: '#b4c4ce', win: '#f1dcac' }
                ],
                playerCarName: 'OPALA SS 74 V8',
                playerCarColor: 0xeab308,
                copName: 'PMERJ PATRULHA',
                copColor: 0x1e3a8a,
                secretCarName: 'CORCOVADO GT TURBO',
                secretCarColor: 0x10b981
            }
        };

