/* ================================================================
   field-quotes mockups — seed catalogue & sample data
   In the real app this lives in Postgres. Here it's in-memory so
   the mockups stand alone and demo the full flow end-to-end.
   ================================================================ */

window.MockData = (function () {

  // -------------------------------------------------------------
  // Suppliers
  // -------------------------------------------------------------
  const suppliers = [
    { id: 'sup_amber',    name: 'Amber Technology',    code: 'AMBER', leadDays: 7,  preferred: true,
      contact: { name: 'Sarah Chen',     phone: '02 9999 1100', email: 'sarah.chen@ambertech.com.au' } },
    { id: 'sup_rutledge', name: 'Rutledge AV',         code: 'RUTL',  leadDays: 5,  preferred: true,
      contact: { name: 'James Patel',    phone: '03 8888 4422', email: 'jpatel@rutledgeav.com.au' } },
    { id: 'sup_hills',    name: 'Hills',               code: 'HILLS', leadDays: 4,  preferred: false,
      contact: { name: 'Megan Walters',  phone: '02 7777 2233', email: 'megan.walters@hills.com.au' } },
    { id: 'sup_madison',  name: 'Madison Technologies',code: 'MAD',   leadDays: 10, preferred: false,
      contact: { name: 'David Nguyen',   phone: '02 6666 5511', email: 'dnguyen@madisontech.com.au' } },
    { id: 'sup_jands',    name: 'Jands',               code: 'JANDS', leadDays: 7,  preferred: true,
      contact: { name: 'Rebecca Foster', phone: '02 5555 7788', email: 'r.foster@jands.com.au' } },
    { id: 'sup_anixter',  name: 'Anixter (Wesco)',     code: 'ANX',   leadDays: 3,  preferred: false,
      contact: { name: 'Tom Birkhauser', phone: '03 4444 9933', email: 'tom.b@wesco.com' } }
  ];

  // -------------------------------------------------------------
  // Category tree
  // -------------------------------------------------------------
  const categories = [
    { name: 'Audio',                 subs: ['Ceiling Speakers', 'Surface Mount Speakers', 'Subwoofers', 'DSP / Audio Processors', 'Amplifiers', 'Microphones (ceiling array)', 'Microphones (handheld / lapel)', 'Audio Conferencing', 'Racks & Accessories'] },
    { name: 'Visual',                subs: ['Displays (commercial)', 'Displays (interactive / touch)', 'Video Walls', 'Projectors', 'Projection Screens', 'Video Conferencing (cameras)'] },
    { name: 'AV Control & Switching',subs: ['Control Processors', 'Touch Panels', 'AV Switchers / Matrices', 'Extenders (HDBaseT)', 'Collaboration (ClickShare / wireless)', 'Signal Distribution'] },
    { name: 'Unified Communications',subs: ['MTR Systems', 'Zoom Rooms', 'Video Bars', 'Speakerphones'] },
    { name: 'Digital Signage',       subs: ['Media Players', 'CMS Licences', 'Mounts & Enclosures'] },
    { name: 'Networking',            subs: ['Switches (PoE)', 'Wireless Access Points', 'Patch Panels', 'Racks & Enclosures'] },
    { name: 'Cabling & Pathways',    subs: ['CAT6 / CAT6A', 'HDMI / AV Cable', 'Audio Cable', 'Speaker Cable', 'Conduit & Trunking', 'Cable Management'] },
    { name: 'Power',                 subs: ['UPS', 'PDUs', 'Power Conditioning'] },
    { name: 'Mounts & Structural',   subs: ['Display Mounts (fixed)', 'Display Mounts (adjustable)', 'Ceiling Mounts', 'Floor Stands', 'Rack Furniture'] },
    { name: 'Consumables',           subs: ['Faceplates & Wall Plates', 'Connectors & Terminations', 'Labels & Marking'] }
  ];

  // -------------------------------------------------------------
  // Products (representative — not the full SKS catalogue)
  // -------------------------------------------------------------
  const products = [
    // --- Audio ---
    { id:'p_001', mfr:'Biamp',     mpn:'Desono C-IC6',     desc:'Desono C-IC6 6.5" ceiling speaker, white',                            short:'Biamp Desono C-IC6 Ceiling Speaker', cat:'Audio', sub:'Ceiling Speakers',     unit:'each', cost:185.00,  rrp:295.00,  supplierId:'sup_amber'   },
    { id:'p_002', mfr:'Biamp',     mpn:'TesiraFORTE X 400',desc:'TesiraFORTÉ X 400 DSP, 12x8 mic/line, AVB, Dante, USB',               short:'Biamp TesiraFORTÉ X 400 DSP',         cat:'Audio', sub:'DSP / Audio Processors',unit:'each', cost:4280.00, rrp:6450.00, supplierId:'sup_amber'   },
    { id:'p_003', mfr:'Biamp',     mpn:'TCM-XA EX',        desc:'Parlé TCM-XA EX ceiling beamtracking mic, PoE+, expansion',           short:'Biamp Parlé TCM-XA EX Ceiling Mic',  cat:'Audio', sub:'Microphones (ceiling array)', unit:'each', cost:2890.00, rrp:4290.00, supplierId:'sup_amber'   },
    { id:'p_004', mfr:'Crown',     mpn:'CDi 4|300BL',      desc:'Crown CDi DriveCore 4 x 300W amplifier, BLU-Link, 70V/100V',          short:'Crown CDi 4|300BL Amplifier',         cat:'Audio', sub:'Amplifiers',           unit:'each', cost:1485.00, rrp:2250.00, supplierId:'sup_jands'   },
    { id:'p_005', mfr:'Shure',     mpn:'MXA920-S',         desc:'Shure Microflex MXA920 square ceiling array mic, white',              short:'Shure MXA920 Ceiling Array',          cat:'Audio', sub:'Microphones (ceiling array)', unit:'each', cost:3950.00, rrp:5990.00, supplierId:'sup_jands'   },
    { id:'p_006', mfr:'Sennheiser',mpn:'TCC 2',            desc:'TeamConnect Ceiling 2 beamforming ceiling mic, white',                short:'Sennheiser TCC 2 Ceiling Mic',        cat:'Audio', sub:'Microphones (ceiling array)', unit:'each', cost:4790.00, rrp:6990.00, supplierId:'sup_jands'   },
    { id:'p_007', mfr:'Yamaha',    mpn:'VXC4',             desc:'Yamaha VXC4 4" ceiling speaker, white (each, sold in pairs)',         short:'Yamaha VXC4 Ceiling Speaker',         cat:'Audio', sub:'Ceiling Speakers',     unit:'each', cost:128.00,  rrp:195.00,  supplierId:'sup_amber'   },

    // --- Visual ---
    { id:'p_010', mfr:'Samsung',   mpn:'QM55C',            desc:'Samsung QM55C 55" commercial 4K display, 500cd, 24/7',                short:'Samsung QM55C 55" Display',           cat:'Visual', sub:'Displays (commercial)',  unit:'each', cost:1340.00, rrp:2090.00, supplierId:'sup_madison' },
    { id:'p_011', mfr:'Samsung',   mpn:'QM75C',            desc:'Samsung QM75C 75" commercial 4K display, 500cd, 24/7',                short:'Samsung QM75C 75" Display',           cat:'Visual', sub:'Displays (commercial)',  unit:'each', cost:2680.00, rrp:3990.00, supplierId:'sup_madison' },
    { id:'p_012', mfr:'Samsung',   mpn:'QM86C',            desc:'Samsung QM86C 86" commercial 4K display, 500cd, 24/7',                short:'Samsung QM86C 86" Display',           cat:'Visual', sub:'Displays (commercial)',  unit:'each', cost:3680.00, rrp:5490.00, supplierId:'sup_madison' },
    { id:'p_013', mfr:'LG',        mpn:'86TR3DK-B',        desc:'LG CreateBoard 86" interactive touch display, 4K, Android',           short:'LG 86" Interactive Display',          cat:'Visual', sub:'Displays (interactive / touch)', unit:'each', cost:4290.00, rrp:6390.00, supplierId:'sup_madison' },
    { id:'p_014', mfr:'Epson',     mpn:'EB-L735U',         desc:'Epson EB-L735U laser projector, WUXGA, 7000lm',                       short:'Epson EB-L735U Laser Projector',      cat:'Visual', sub:'Projectors',             unit:'each', cost:2950.00, rrp:4490.00, supplierId:'sup_amber'   },
    { id:'p_015', mfr:'Da-Lite',   mpn:'Tensioned Pro Imager 120"', desc:'Da-Lite tensioned electric screen, 120" diag, 16:9',          short:'Da-Lite 120" Electric Screen',        cat:'Visual', sub:'Projection Screens',     unit:'each', cost:1840.00, rrp:2790.00, supplierId:'sup_jands'   },

    // --- AV Control & Switching ---
    { id:'p_020', mfr:'Crestron',  mpn:'CP4N-R',           desc:'Crestron 4-Series Network Control System CP4N-R',                    short:'Crestron CP4N-R Processor',           cat:'AV Control & Switching', sub:'Control Processors', unit:'each', cost:2680.00, rrp:3990.00, supplierId:'sup_amber' },
    { id:'p_021', mfr:'Crestron',  mpn:'TS-1070-B-S',      desc:'Crestron 10.1" Tabletop Touch Screen, black, Smooth',                short:'Crestron 10" Touch Screen',           cat:'AV Control & Switching', sub:'Touch Panels',       unit:'each', cost:2380.00, rrp:3590.00, supplierId:'sup_amber' },
    { id:'p_022', mfr:'Crestron',  mpn:'HD-MD-NVX-21-E',   desc:'Crestron NVX 4K AV-over-IP encoder/decoder',                          short:'Crestron NVX 4K Encoder/Decoder',     cat:'AV Control & Switching', sub:'AV Switchers / Matrices', unit:'each', cost:2480.00, rrp:3690.00, supplierId:'sup_amber' },
    { id:'p_023', mfr:'Atlona',    mpn:'AT-HDR-EX-100CEA-KIT',desc:'Atlona HDBaseT extender kit, 100m, HDR, PoE',                      short:'Atlona HDBaseT Extender 100m',        cat:'AV Control & Switching', sub:'Extenders (HDBaseT)', unit:'each', cost:740.00,  rrp:1190.00, supplierId:'sup_rutledge' },
    { id:'p_024', mfr:'Barco',     mpn:'CX-50 Gen2',       desc:'Barco ClickShare CX-50 Gen2 wireless conferencing',                   short:'Barco ClickShare CX-50 Gen2',         cat:'AV Control & Switching', sub:'Collaboration (ClickShare / wireless)', unit:'each', cost:2890.00, rrp:4490.00, supplierId:'sup_madison' },

    // --- Unified Communications ---
    { id:'p_030', mfr:'Logitech',  mpn:'Rally Bar',        desc:'Logitech Rally Bar all-in-one MTR/Zoom video bar, graphite',          short:'Logitech Rally Bar',                  cat:'Unified Communications', sub:'Video Bars',     unit:'each', cost:3380.00, rrp:4990.00, supplierId:'sup_madison' },
    { id:'p_031', mfr:'Logitech',  mpn:'Tap Scheduler',    desc:'Logitech Tap Scheduler 10.1" room booking panel, graphite',           short:'Logitech Tap Scheduler',              cat:'Unified Communications', sub:'MTR Systems',    unit:'each', cost:890.00,  rrp:1390.00, supplierId:'sup_madison' },
    { id:'p_032', mfr:'Poly',      mpn:'Studio X70',       desc:'Poly Studio X70 video bar for larger rooms, dual-camera, MTR/Zoom',   short:'Poly Studio X70 Video Bar',           cat:'Unified Communications', sub:'Video Bars',     unit:'each', cost:6890.00, rrp:9990.00, supplierId:'sup_amber'   },
    { id:'p_033', mfr:'Jabra',     mpn:'Speak2 75',        desc:'Jabra Speak2 75 USB/BT speakerphone',                                  short:'Jabra Speak2 75 Speakerphone',        cat:'Unified Communications', sub:'Speakerphones',  unit:'each', cost:340.00,  rrp:520.00,  supplierId:'sup_madison' },

    // --- Networking ---
    { id:'p_040', mfr:'NETGEAR',   mpn:'GSM4248P',         desc:'NETGEAR M4250-40G8XF-PoE+ AV-line managed switch, 40x1G + 8x10G',     short:'NETGEAR M4250 48-port AV Switch',     cat:'Networking', sub:'Switches (PoE)',  unit:'each', cost:3680.00, rrp:5390.00, supplierId:'sup_hills'   },
    { id:'p_041', mfr:'Cisco',     mpn:'C9300-48P-A',      desc:'Cisco Catalyst 9300 48-port PoE+ switch, Network Advantage',           short:'Cisco C9300-48P-A Switch',            cat:'Networking', sub:'Switches (PoE)',  unit:'each', cost:8480.00, rrp:11990.00,supplierId:'sup_anixter' },
    { id:'p_042', mfr:'Ubiquiti',  mpn:'U7-Pro',           desc:'Ubiquiti U7 Pro Wi-Fi 7 access point, ceiling mount',                  short:'Ubiquiti U7 Pro WAP',                 cat:'Networking', sub:'Wireless Access Points', unit:'each', cost:228.00,  rrp:349.00,  supplierId:'sup_hills'   },

    // --- Cabling ---
    { id:'p_050', mfr:'Excel',     mpn:'CAT6A-LSZH-305',   desc:'Excel CAT6A U/FTP LSZH 305m box, violet',                              short:'Excel CAT6A LSZH 305m',               cat:'Cabling & Pathways', sub:'CAT6 / CAT6A', unit:'box',  cost:680.00,  rrp:990.00,  supplierId:'sup_anixter' },
    { id:'p_051', mfr:'Kordz',     mpn:'PRO3 HDMI 5m',     desc:'Kordz PRO3 HDMI 2.1 cable 5m, 48Gbps',                                 short:'Kordz PRO3 HDMI 5m',                  cat:'Cabling & Pathways', sub:'HDMI / AV Cable', unit:'each', cost:48.00,   rrp:79.00,   supplierId:'sup_amber'   },
    { id:'p_052', mfr:'Belden',    mpn:'1800F',            desc:'Belden 1800F single-pair audio cable, 305m reel',                      short:'Belden 1800F Audio Cable 305m',       cat:'Cabling & Pathways', sub:'Audio Cable', unit:'reel', cost:380.00,  rrp:540.00,  supplierId:'sup_anixter' },

    // --- Power ---
    { id:'p_060', mfr:'APC',       mpn:'SMT1500RMI2UC',    desc:'APC Smart-UPS 1500VA 2U rack, SmartConnect',                            short:'APC Smart-UPS 1500VA 2U',             cat:'Power', sub:'UPS', unit:'each', cost:1290.00, rrp:1990.00, supplierId:'sup_hills' },

    // --- Mounts ---
    { id:'p_070', mfr:'Chief',     mpn:'MTM1U',            desc:'Chief MTM1U fixed tilt wall mount, 32"-65"',                            short:'Chief MTM1U Fixed Mount',             cat:'Mounts & Structural', sub:'Display Mounts (fixed)', unit:'each', cost:240.00, rrp:380.00, supplierId:'sup_amber' },
    { id:'p_071', mfr:'Chief',     mpn:'XSM1U',            desc:'Chief XSM1U fixed wall mount, 55"-90"',                                 short:'Chief XSM1U Large Display Mount',      cat:'Mounts & Structural', sub:'Display Mounts (fixed)', unit:'each', cost:380.00, rrp:590.00, supplierId:'sup_amber' },

    // --- Consumables ---
    { id:'p_080', mfr:'Clipsal',   mpn:'30AVUR',           desc:'Clipsal 30 series AV faceplate, brushed aluminium',                     short:'Clipsal AV Faceplate',                cat:'Consumables', sub:'Faceplates & Wall Plates', unit:'each', cost:38.00, rrp:62.00, supplierId:'sup_hills' },
    { id:'p_081', mfr:'Generic',   mpn:'RJ45-CAT6A',       desc:'CAT6A keystone jack, white',                                            short:'CAT6A Keystone',                       cat:'Consumables', sub:'Connectors & Terminations', unit:'each', cost:5.20, rrp:9.50, supplierId:'sup_anixter' }
  ];

  // -------------------------------------------------------------
  // Labour defaults — hours per unit, by subcategory + trade
  // -------------------------------------------------------------
  const labourDefaults = {
    'Ceiling Speakers':          { hours: 0.50, trade: 'AV Tech',         task: 'Install ceiling speaker, terminate, test' },
    'Surface Mount Speakers':    { hours: 0.40, trade: 'AV Tech',         task: 'Mount surface speaker, terminate, test' },
    'Subwoofers':                { hours: 0.50, trade: 'AV Tech',         task: 'Place and terminate subwoofer' },
    'DSP / Audio Processors':    { hours: 2.00, trade: 'AV Tech',         task: 'Rack DSP, terminate I/O, label' },
    'Amplifiers':                { hours: 1.00, trade: 'AV Tech',         task: 'Rack amp, terminate, label' },
    'Microphones (ceiling array)':{hours: 1.50, trade: 'AV Tech',         task: 'Ceiling mount mic, terminate, test' },
    'Microphones (handheld / lapel)':{ hours: 0.20, trade: 'AV Tech',     task: 'Pair handheld/lapel mic' },
    'Audio Conferencing':        { hours: 1.00, trade: 'AV Tech',         task: 'Install, network, test conferencing device' },
    'Racks & Accessories':       { hours: 0.50, trade: 'AV Tech',         task: 'Rack accessory install' },
    'Displays (commercial)':     { hours: 1.50, trade: 'AV Tech',         task: 'Wall-mount display, terminate, configure' },
    'Displays (interactive / touch)':{hours: 2.50, trade: 'AV Tech',      task: 'Install interactive display, configure inputs' },
    'Video Walls':               { hours: 4.00, trade: 'AV Tech',         task: 'Per-tile install and alignment' },
    'Projectors':                { hours: 3.00, trade: 'AV Tech',         task: 'Ceiling-mount and align projector' },
    'Projection Screens':        { hours: 2.00, trade: 'AV Tech',         task: 'Install electric screen and trigger' },
    'Video Conferencing (cameras)':{ hours: 1.00, trade: 'AV Tech',       task: 'Install and configure camera' },
    'Control Processors':        { hours: 2.00, trade: 'AV Tech',         task: 'Rack processor and connect' },
    'Touch Panels':              { hours: 1.00, trade: 'AV Tech',         task: 'Mount touch panel, network, configure' },
    'AV Switchers / Matrices':   { hours: 1.50, trade: 'AV Tech',         task: 'Rack, terminate, configure switcher' },
    'Extenders (HDBaseT)':       { hours: 0.50, trade: 'AV Tech',         task: 'Install extender pair, terminate' },
    'Collaboration (ClickShare / wireless)':{ hours: 0.50, trade: 'AV Tech', task: 'Configure and pair ClickShare base/buttons' },
    'Signal Distribution':       { hours: 1.00, trade: 'AV Tech',         task: 'Install distribution amp' },
    'MTR Systems':               { hours: 3.00, trade: 'AV Tech',         task: 'Install MTR compute, peripherals, sign in' },
    'Zoom Rooms':                { hours: 3.00, trade: 'AV Tech',         task: 'Install Zoom Room compute, peripherals, sign in' },
    'Video Bars':                { hours: 1.50, trade: 'AV Tech',         task: 'Mount video bar, network, configure UC' },
    'Speakerphones':             { hours: 0.20, trade: 'AV Tech',         task: 'Place and pair speakerphone' },
    'Media Players':             { hours: 0.50, trade: 'AV Tech',         task: 'Install media player, load content' },
    'CMS Licences':              { hours: 0.10, trade: 'AV Tech',         task: 'Activate CMS licence' },
    'Mounts & Enclosures':       { hours: 0.50, trade: 'AV Tech',         task: 'Install enclosure / signage mount' },
    'Switches (PoE)':            { hours: 1.00, trade: 'Data Tech',       task: 'Rack switch, configure ports/VLANs' },
    'Wireless Access Points':    { hours: 0.50, trade: 'Data Tech',       task: 'Mount AP, terminate, configure' },
    'Patch Panels':              { hours: 1.00, trade: 'Data Tech',       task: 'Mount patch panel, terminate runs' },
    'Racks & Enclosures':        { hours: 2.00, trade: 'AV Tech',         task: 'Assemble and mount rack' },
    'CAT6 / CAT6A':              { hours: 0.50, trade: 'Data Tech',       task: 'Per-run pull and terminate (per outlet)' },
    'HDMI / AV Cable':           { hours: 0.10, trade: 'AV Tech',         task: 'Place and dress cable' },
    'Audio Cable':               { hours: 0.10, trade: 'AV Tech',         task: 'Pull and dress audio cable' },
    'Speaker Cable':             { hours: 0.10, trade: 'AV Tech',         task: 'Pull and dress speaker cable' },
    'Conduit & Trunking':        { hours: 0.50, trade: 'Electrician',     task: 'Install conduit / trunking (per m)' },
    'Cable Management':          { hours: 0.10, trade: 'AV Tech',         task: 'Cable lacing and labels' },
    'UPS':                       { hours: 0.50, trade: 'Electrician',     task: 'Rack UPS, connect, label' },
    'PDUs':                      { hours: 0.30, trade: 'Electrician',     task: 'Mount PDU, connect' },
    'Power Conditioning':        { hours: 0.30, trade: 'Electrician',     task: 'Install power conditioner' },
    'Display Mounts (fixed)':    { hours: 0.50, trade: 'AV Tech',         task: 'Locate, fix mount to wall' },
    'Display Mounts (adjustable)':{hours: 0.75, trade: 'AV Tech',         task: 'Locate, fix adjustable mount' },
    'Ceiling Mounts':            { hours: 1.50, trade: 'AV Tech',         task: 'Locate, fix ceiling mount, ceiling work' },
    'Floor Stands':              { hours: 0.50, trade: 'AV Tech',         task: 'Assemble floor stand' },
    'Rack Furniture':            { hours: 0.50, trade: 'AV Tech',         task: 'Install rack furniture' },
    'Faceplates & Wall Plates':  { hours: 0.20, trade: 'AV Tech',         task: 'Install faceplate, terminate' },
    'Connectors & Terminations': { hours: 0.05, trade: 'AV Tech',         task: 'Per-connector terminate' },
    'Labels & Marking':          { hours: 0.05, trade: 'AV Tech',         task: 'Per-label' }
  };

  // -------------------------------------------------------------
  // Labour rates per trade (loaded sell rate, ex-GST)
  // -------------------------------------------------------------
  const labourRates = {
    'AV Tech':     145.00,
    'Data Tech':   135.00,
    'Electrician': 165.00,
    'PM':          175.00
  };

  // -------------------------------------------------------------
  // Services (pre-defined non-product charge items)
  // -------------------------------------------------------------
  const services = [
    { id:'s_pm',     name:'Project Management',  category:'Labour',     unit:'hr',  defaultRate: 175.00, defaultQty: 0,  marginPct: 25, includedByDefault: true  },
    { id:'s_super',  name:'Site Supervision',    category:'Labour',     unit:'day', defaultRate: 1100.00,defaultQty: 0,  marginPct: 25, includedByDefault: false },
    { id:'s_comm',   name:'Commissioning & Testing', category:'Labour', unit:'hr',  defaultRate: 165.00, defaultQty: 0,  marginPct: 20, includedByDefault: true  },
    { id:'s_prog',   name:'System Programming',  category:'Labour',     unit:'hr',  defaultRate: 195.00, defaultQty: 0,  marginPct: 25, includedByDefault: true  },
    { id:'s_docs',   name:'Documentation',       category:'Labour',     unit:'lot', defaultRate: 850.00, defaultQty: 1,  marginPct: 30, includedByDefault: true  },
    { id:'s_train',  name:'Training',            category:'Labour',     unit:'hr',  defaultRate: 165.00, defaultQty: 0,  marginPct: 25, includedByDefault: false },
    { id:'s_travel', name:'Travel & Accommodation', category:'Expense', unit:'lot', defaultRate: 0,      defaultQty: 1,  marginPct: 0,  includedByDefault: false },
    { id:'s_freight',name:'Freight & Delivery',  category:'Expense',    unit:'lot', defaultRate: 320.00, defaultQty: 1,  marginPct: 0,  includedByDefault: true  },
    { id:'s_ahw',    name:'After-Hours Work',    category:'Labour',     unit:'hr',  defaultRate: 245.00, defaultQty: 0,  marginPct: 30, includedByDefault: false },
    { id:'s_elec',   name:'Electrical',          category:'Labour',     unit:'hr',  defaultRate: 145.00, defaultQty: 0,  marginPct: 25, includedByDefault: false },
    { id:'s_warr',   name:'Warranty & Support',  category:'Labour',     unit:'lot', defaultRate: 0,      defaultQty: 1,  marginPct: 30, includedByDefault: false }
  ];

  // -------------------------------------------------------------
  // Packages — common combinations
  // -------------------------------------------------------------
  const packages = [
    {
      id: 'pkg_boardroom_mtr',
      name: 'Standard Boardroom MTR System',
      description: 'Single display, ceiling mic + speakers, Logitech Rally Bar + Tap, Crestron control',
      tags: ['Boardroom', 'MTR'],
      items: [
        { productId: 'p_011', qty: 1 },     // Samsung QM75C 75"
        { productId: 'p_071', qty: 1 },     // Chief XSM1U mount
        { productId: 'p_030', qty: 1 },     // Logitech Rally Bar
        { productId: 'p_031', qty: 1 },     // Tap Scheduler
        { productId: 'p_005', qty: 1 },     // Shure MXA920
        { productId: 'p_001', qty: 4 },     // Biamp Desono C-IC6
        { productId: 'p_004', qty: 1 },     // Crown amp
        { productId: 'p_020', qty: 1 },     // Crestron CP4N-R
        { productId: 'p_021', qty: 1 },     // Crestron 10" TS
        { productId: 'p_050', qty: 1 }      // CAT6A box
      ]
    },
    {
      id: 'pkg_meeting_small',
      name: 'Small Meeting Room (4–6 ppl)',
      description: 'Single 55" display, video bar, simple control',
      tags: ['Meeting Room', 'UC'],
      items: [
        { productId: 'p_010', qty: 1 },     // Samsung QM55C
        { productId: 'p_070', qty: 1 },     // Chief MTM1U
        { productId: 'p_030', qty: 1 },     // Logitech Rally Bar
        { productId: 'p_031', qty: 1 },     // Tap Scheduler
        { productId: 'p_080', qty: 1 },     // Faceplate
        { productId: 'p_051', qty: 1 }      // HDMI cable
      ]
    },
    {
      id: 'pkg_digital_signage_single',
      name: 'Digital Signage — Single Screen',
      description: '55" display, fixed mount, media player',
      tags: ['Signage'],
      items: [
        { productId: 'p_010', qty: 1 },
        { productId: 'p_070', qty: 1 }
      ]
    },
    {
      id: 'pkg_training_room',
      name: 'Training Room (12–20 ppl)',
      description: '86" interactive display + projector + screen',
      tags: ['Training Room'],
      items: [
        { productId: 'p_013', qty: 1 },     // LG interactive 86"
        { productId: 'p_071', qty: 1 },     // XSM1U mount
        { productId: 'p_014', qty: 1 },     // Epson projector
        { productId: 'p_015', qty: 1 },     // Da-Lite screen
        { productId: 'p_005', qty: 2 },     // Shure MXA920 x 2
        { productId: 'p_001', qty: 8 },     // Ceiling speakers
        { productId: 'p_004', qty: 1 },     // Amp
        { productId: 'p_002', qty: 1 },     // DSP
        { productId: 'p_020', qty: 1 },     // Crestron processor
        { productId: 'p_021', qty: 1 }      // Crestron touch
      ]
    }
  ];

  // -------------------------------------------------------------
  // Standard exclusions library
  // -------------------------------------------------------------
  const exclusionsLibrary = [
    'Patching and making good of walls, ceilings, and floors after AV/data works.',
    'Electrical works including new GPOs, isolators, and dedicated circuits — by others.',
    'Structural works including framing, blocking, and load-bearing modifications.',
    'High-level access equipment (EWP/scissor lift) hire beyond standard ladder height.',
    'After-hours and weekend work unless explicitly noted.',
    'Network infrastructure beyond the SKS-supplied equipment.',
    'Removal and disposal of existing equipment beyond what is itemised.',
    'Permits, council approvals, building certifications.',
    'Asbestos testing or removal.',
    'Programming changes after initial commissioning sign-off — covered under variation.',
    'Furniture, joinery modifications, and lectern fit-outs.'
  ];

  // -------------------------------------------------------------
  // Standard terms (single template string)
  // -------------------------------------------------------------
  const standardTerms = `Quote valid for 30 days from issue date.
Pricing is exclusive of GST and based on a single mobilisation, standard business hours (Mon–Fri 7am–5pm).
Payment terms: 30 days from invoice. Progress claims may apply on projects over $25,000.
Title to goods remains with SKS Technologies until payment is received in full.
Lead times are indicative and subject to supplier confirmation at order placement.
All works to AS/NZS 3000 and relevant standards. Programming changes after commissioning sign-off treated as variation.
SKS Technologies Pty Ltd · ABN 12 345 678 901`;

  // -------------------------------------------------------------
  // Pre-seeded existing quotes (so the quote list has data to show)
  // -------------------------------------------------------------
  const sampleQuotes = [
    { id:'q_2026_0048', number:'SKS-2026-0048', revision:'A', status:'draft',    mode:'large', preparedBy:'Mark Stowell', createdAt:'2026-05-14', validUntil:'2026-06-13', value:0,
      client:{ name:'Adelaide City Council', contact:'Procurement Office', email:'procurement@cityofadelaide.sa.gov.au', phone:'(08) 8203 7203', address:'25 Pirie St, Adelaide SA 5000' },
      project:{ name:'Town Hall — meeting room refresh', address:'Adelaide Town Hall, King William St' } },
    { id:'q_2026_0047', number:'SKS-2026-0047', revision:'A', status:'draft',    mode:'large', preparedBy:'Mark Stowell', createdAt:'2026-05-13', validUntil:'2026-06-12', value:0,
      client:{ name:'North Adelaide Plains Golf Club', contact:'Glen Adams', email:'glen@napgc.com.au', phone:'(08) 8523 1144', address:'Two Wells Rd, Two Wells SA' },
      project:{ name:'Clubhouse AV refresh — Level 1', address:'NAPGC Clubhouse' } },
    { id:'q_2026_0046', number:'SKS-2026-0046', revision:'B', status:'issued',   mode:'large', preparedBy:'Mark Stowell', createdAt:'2026-05-12', validUntil:'2026-06-11', value:58940,
      client:{ name:'Verdale Cres Pty Ltd', contact:'John Verdale', email:'john@verdalecres.com.au', phone:'(08) 8123 4567', address:'12 Verdale Cres, Glenelg SA 5045' },
      project:{ name:'Boardroom MTR upgrade', address:'12 Verdale Cres, Glenelg SA 5045' } },
    { id:'q_2026_0045', number:'SKS-2026-0045', revision:'A', status:'accepted', mode:'quick', preparedBy:'Mark Stowell', createdAt:'2026-05-10', validUntil:'2026-06-09', value:12480,
      client:{ name:'Rutledge AV', contact:'Sarah Rutledge', email:'sarah@rutledge.com.au', phone:'(08) 8345 9876', address:'56 Magill Rd, Stepney SA 5069' },
      project:{ name:'Hospitality fitout — supply only', address:'Stepney warehouse' } },
    { id:'q_2026_0044', number:'SKS-2026-0044', revision:'A', status:'issued',   mode:'large', preparedBy:'Steven Carmichael', createdAt:'2026-05-07', validUntil:'2026-06-06', value:312560,
      client:{ name:'SA Department of Education', contact:'Project Office', email:'projects@education.sa.gov.au', phone:'(08) 8226 1000', address:'31 Flinders St, Adelaide SA 5000' },
      project:{ name:'Glenelg Primary — 4 classrooms + library', address:'Glenelg Primary School' } },
    { id:'q_2026_0043', number:'SKS-2026-0043', revision:'A', status:'declined', mode:'large', preparedBy:'Mark Stowell', createdAt:'2026-05-03', validUntil:'2026-06-02', value:48720,
      client:{ name:'Adelaide Convention Centre', contact:'Bookings team', email:'av@adelaidecc.com.au', phone:'(08) 8210 6677', address:'North Tce, Adelaide SA 5000' },
      project:{ name:'Pre-function digital signage', address:'Adelaide Convention Centre' } },
    { id:'q_2026_0042', number:'SKS-2026-0042', revision:'A', status:'issued',   mode:'large', preparedBy:'Mark Stowell', createdAt:'2026-04-28', validUntil:'2026-05-28', value:94180,
      client:{ name:'University of Adelaide', contact:'Tim Bell', email:'tim.bell@adelaide.edu.au', phone:'(08) 8313 5678', address:'North Tce, Adelaide SA 5005' },
      project:{ name:'Engineering — Lecture Theatre 2 refresh', address:'Engineering Building' } },
    { id:'q_2026_0041', number:'SKS-2026-0041', revision:'A', status:'accepted', mode:'quick', preparedBy:'Mark Stowell', createdAt:'2026-04-22', validUntil:'2026-05-22', value:3840,
      client:{ name:'North Adelaide Plains Golf Club', contact:'Glen', email:'glen@napgc.com.au', phone:'(08) 8523 1144', address:'Two Wells Rd, Two Wells SA' },
      project:{ name:'Pro shop signage', address:'NAPGC clubhouse' } },
    { id:'q_2026_0040', number:'SKS-2026-0040', revision:'C', status:'expired',  mode:'large', preparedBy:'Steven Carmichael', createdAt:'2026-04-18', validUntil:'2026-05-18', value:487990,
      client:{ name:'Adelaide Oval SMA', contact:'Facilities', email:'facilities@adelaideoval.com.au', phone:'(08) 8211 1100', address:'King William Rd, Adelaide SA' },
      project:{ name:'Western Stand corporate boxes — AV+UC', address:'Adelaide Oval' } },
    { id:'q_2026_0039', number:'SKS-2026-0039', revision:'A', status:'revised',  mode:'quick', preparedBy:'Mark Stowell', createdAt:'2026-04-15', validUntil:'2026-05-15', value:18640,
      client:{ name:'Royal Adelaide Hospital', contact:'Biomed', email:'biomed@sahealth.sa.gov.au', phone:'(08) 7074 0000', address:'Port Rd, Adelaide SA' },
      project:{ name:'Theatre 4 — UC variation', address:'RAH Theatre 4' } },
    { id:'q_2026_0038', number:'SKS-2026-0038', revision:'A', status:'accepted', mode:'large', preparedBy:'Steven Carmichael', createdAt:'2026-04-10', validUntil:'2026-05-10', value:216400,
      client:{ name:'Holdfast Bay Council', contact:'Council Chambers', email:'avtech@holdfast.sa.gov.au', phone:'(08) 8229 9999', address:'24 Jetty Rd, Glenelg SA' },
      project:{ name:'Civic Centre — Council chamber refresh', address:'Holdfast Bay Civic Centre' } }
  ];

  // -------------------------------------------------------------
  // Seed content for sample quotes — lets the demo show realistic
  // populated quotes the moment you click into them. Each entry is
  // { areas: [{name, type, notes, lines: [{productId, qty, ...}]}],
  //   services: { serviceId: { qty, rate, marginPct } },
  //   globalMarginPct?, exclusions? }
  // -------------------------------------------------------------
  const seedSpecs = {
    // ----- Drafts (in progress) -----
    q_2026_0048: {
      globalMarginPct: 25,
      areas: [
        { name: 'Meeting Room A', type: 'Meeting Room', notes: 'Boardroom-style, 8–12 ppl, premium fitout', lines: [
          { productId: 'p_011', qty: 1 }, { productId: 'p_071', qty: 1 },
          { productId: 'p_030', qty: 1 }, { productId: 'p_031', qty: 1 },
          { productId: 'p_080', qty: 2 }, { productId: 'p_051', qty: 2 }
        ]},
        { name: 'Meeting Room B', type: 'Meeting Room', notes: 'Smaller huddle, 4–6 ppl — products TBD', lines: [] },
        { name: 'Reception', type: 'Reception', notes: 'Single signage display behind front desk', lines: [
          { productId: 'p_010', qty: 1 }, { productId: 'p_070', qty: 1 }
        ]}
      ],
      services: { 's_pm': { qty: 16 }, 's_comm': { qty: 6 }, 's_prog': { qty: 8 }, 's_docs': {}, 's_freight': { rate: 320 } }
    },
    q_2026_0047: {
      globalMarginPct: 30,
      areas: [
        { name: 'Clubhouse Bistro', type: 'Hospitality', notes: 'Background music + 4x sports displays', lines: [
          { productId: 'p_010', qty: 4 }, { productId: 'p_070', qty: 4 },
          { productId: 'p_001', qty: 8 }, { productId: 'p_004', qty: 1 },
          { productId: 'p_002', qty: 1 }
        ]},
        { name: 'Function Room', type: 'Function', notes: '120-person events space, projection + portable PA', lines: [
          { productId: 'p_014', qty: 1 }, { productId: 'p_015', qty: 1 },
          { productId: 'p_001', qty: 6 }, { productId: 'p_004', qty: 1 },
          { productId: 'p_007', qty: 4, lineNote: 'Surface-mount perimeter speakers' }
        ]}
      ],
      services: { 's_pm': { qty: 32 }, 's_comm': { qty: 12 }, 's_prog': { qty: 12 }, 's_docs': {}, 's_freight': { rate: 480 }, 's_travel': { rate: 600 } }
    },

    // ----- Issued / Accepted / etc. -----
    q_2026_0046: {
      areas: [{
        name: 'Level 3 Boardroom', type: 'Boardroom',
        notes: '12-person table, single 75" display end of room, ceiling capture for hybrid meetings',
        lines: [
          { productId: 'p_011', qty: 1, packageId: 'pkg_boardroom_mtr' },
          { productId: 'p_071', qty: 1, packageId: 'pkg_boardroom_mtr' },
          { productId: 'p_030', qty: 1, packageId: 'pkg_boardroom_mtr' },
          { productId: 'p_031', qty: 1, packageId: 'pkg_boardroom_mtr' },
          { productId: 'p_005', qty: 1, packageId: 'pkg_boardroom_mtr' },
          { productId: 'p_001', qty: 4, packageId: 'pkg_boardroom_mtr' },
          { productId: 'p_004', qty: 1, packageId: 'pkg_boardroom_mtr' },
          { productId: 'p_020', qty: 1, packageId: 'pkg_boardroom_mtr' },
          { productId: 'p_021', qty: 1, packageId: 'pkg_boardroom_mtr' },
          { productId: 'p_050', qty: 1, packageId: 'pkg_boardroom_mtr' },
          { productId: 'p_051', qty: 3 }, { productId: 'p_080', qty: 4 }
        ]
      }],
      services: { 's_pm': { qty: 16 }, 's_comm': { qty: 8 }, 's_prog': { qty: 12 }, 's_docs': {}, 's_freight': { rate: 280 } }
    },

    q_2026_0045: {
      globalMarginPct: 18,
      areas: [{
        name: 'Stepney Warehouse — Supply Only', type: 'Supply',
        notes: 'Customer collects from warehouse. No installation, no commissioning.',
        lines: [
          { productId: 'p_010', qty: 4, isSupplyOnly: true },
          { productId: 'p_070', qty: 4, isSupplyOnly: true },
          { productId: 'p_030', qty: 2, isSupplyOnly: true },
          { productId: 'p_001', qty: 12, isSupplyOnly: true },
          { productId: 'p_080', qty: 8, isSupplyOnly: true }
        ]
      }],
      services: { 's_freight': { rate: 380 } }
    },

    q_2026_0044: {
      areas: [
        { name: 'Classroom 1 — STEM Lab', type: 'Classroom', notes: '30 students, interactive front-of-room', lines: [
          { productId: 'p_013', qty: 1 }, { productId: 'p_071', qty: 1 },
          { productId: 'p_001', qty: 4 }, { productId: 'p_004', qty: 1 },
          { productId: 'p_023', qty: 1 }, { productId: 'p_080', qty: 2 }, { productId: 'p_050', qty: 1 }
        ]},
        { name: 'Classroom 2', type: 'Classroom', notes: '28 students', lines: [
          { productId: 'p_013', qty: 1 }, { productId: 'p_071', qty: 1 },
          { productId: 'p_001', qty: 4 }, { productId: 'p_004', qty: 1 }, { productId: 'p_023', qty: 1 }, { productId: 'p_080', qty: 2 }
        ]},
        { name: 'Classroom 3', type: 'Classroom', notes: '28 students', lines: [
          { productId: 'p_013', qty: 1 }, { productId: 'p_071', qty: 1 },
          { productId: 'p_001', qty: 4 }, { productId: 'p_004', qty: 1 }, { productId: 'p_023', qty: 1 }, { productId: 'p_080', qty: 2 }
        ]},
        { name: 'Classroom 4', type: 'Classroom', notes: '28 students', lines: [
          { productId: 'p_013', qty: 1 }, { productId: 'p_071', qty: 1 },
          { productId: 'p_001', qty: 4 }, { productId: 'p_004', qty: 1 }, { productId: 'p_023', qty: 1 }, { productId: 'p_080', qty: 2 }
        ]},
        { name: 'Library — AV Pods + Signage', type: 'Library', notes: 'Open-plan library with 3 AV pods and perimeter signage displays', lines: [
          { productId: 'p_010', qty: 3 }, { productId: 'p_070', qty: 3 },
          { productId: 'p_001', qty: 8, lineNote: 'Background music and announcements' },
          { productId: 'p_004', qty: 1 }, { productId: 'p_002', qty: 1 },
          { productId: 'p_022', qty: 4 }, { productId: 'p_040', qty: 1 },
          { productId: 'p_050', qty: 2 }, { productId: 'p_080', qty: 6 }
        ]}
      ],
      services: { 's_pm': { qty: 60 }, 's_super': { qty: 4 }, 's_comm': { qty: 24 }, 's_prog': { qty: 16 }, 's_docs': {}, 's_train': { qty: 6 }, 's_travel': { rate: 1200 }, 's_freight': { rate: 850 } }
    },

    q_2026_0043: {
      areas: [{
        name: 'Pre-function Foyer — Digital Signage', type: 'Signage',
        notes: '4x wall-mounted 55" displays, NVX-distributed content, single CMS source',
        lines: [
          { productId: 'p_010', qty: 4 }, { productId: 'p_070', qty: 4 },
          { productId: 'p_022', qty: 4 }, { productId: 'p_040', qty: 1 }, { productId: 'p_080', qty: 4 }
        ]
      }],
      services: { 's_pm': { qty: 8 }, 's_comm': { qty: 4 }, 's_prog': { qty: 4 }, 's_freight': { rate: 240 } }
    },

    q_2026_0042: {
      areas: [{
        name: 'Engineering — Lecture Theatre 2', type: 'Lecture Theatre',
        notes: '90 seats. Recorded lectures (ceiling array mics for capture). Lectern + handheld for Q&A.',
        lines: [
          { productId: 'p_013', qty: 1 }, { productId: 'p_071', qty: 1 },
          { productId: 'p_014', qty: 1, lineNote: 'Front-projection backup for room half-darkened' },
          { productId: 'p_015', qty: 1 },
          { productId: 'p_005', qty: 2 }, { productId: 'p_001', qty: 12 },
          { productId: 'p_004', qty: 1 }, { productId: 'p_002', qty: 1 },
          { productId: 'p_020', qty: 1 }, { productId: 'p_021', qty: 1 },
          { productId: 'p_022', qty: 4 }, { productId: 'p_040', qty: 1 },
          { productId: 'p_050', qty: 2 }, { productId: 'p_080', qty: 4 }
        ]
      }],
      services: { 's_pm': { qty: 24 }, 's_comm': { qty: 12 }, 's_prog': { qty: 16 }, 's_docs': {}, 's_train': { qty: 4 }, 's_freight': { rate: 480 } }
    },

    q_2026_0041: {
      mode: 'quick',
      areas: [{
        name: 'Pro Shop', type: 'Retail',
        notes: 'Wall-mounted display above counter, looped course/score content from a media player',
        lines: [
          { productId: 'p_010', qty: 1 }, { productId: 'p_070', qty: 1 }
        ]
      }],
      services: { 's_freight': { rate: 180 } }
    },

    q_2026_0040: {
      areas: [
        { name: 'Box A', type: 'Corporate Box', notes: '20-seat corporate box, premium fitout', lines: [
          { productId: 'p_011', qty: 2 }, { productId: 'p_071', qty: 2 },
          { productId: 'p_030', qty: 1 }, { productId: 'p_005', qty: 1 },
          { productId: 'p_001', qty: 6 }, { productId: 'p_004', qty: 1 }, { productId: 'p_002', qty: 1 },
          { productId: 'p_020', qty: 1 }, { productId: 'p_021', qty: 1 },
          { productId: 'p_022', qty: 2 }, { productId: 'p_040', qty: 1 }
        ]},
        { name: 'Box B', type: 'Corporate Box', notes: 'Identical fitout to Box A', lines: [
          { productId: 'p_011', qty: 2 }, { productId: 'p_071', qty: 2 },
          { productId: 'p_030', qty: 1 }, { productId: 'p_005', qty: 1 },
          { productId: 'p_001', qty: 6 }, { productId: 'p_004', qty: 1 }, { productId: 'p_002', qty: 1 },
          { productId: 'p_020', qty: 1 }, { productId: 'p_021', qty: 1 },
          { productId: 'p_022', qty: 2 }, { productId: 'p_040', qty: 1 }
        ]},
        { name: 'Box C', type: 'Corporate Box', notes: 'Identical fitout to Box A', lines: [
          { productId: 'p_011', qty: 2 }, { productId: 'p_071', qty: 2 },
          { productId: 'p_030', qty: 1 }, { productId: 'p_005', qty: 1 },
          { productId: 'p_001', qty: 6 }, { productId: 'p_004', qty: 1 }, { productId: 'p_002', qty: 1 },
          { productId: 'p_020', qty: 1 }, { productId: 'p_021', qty: 1 },
          { productId: 'p_022', qty: 2 }, { productId: 'p_040', qty: 1 }
        ]},
        { name: 'Box D', type: 'Corporate Box', notes: 'Identical fitout to Box A', lines: [
          { productId: 'p_011', qty: 2 }, { productId: 'p_071', qty: 2 },
          { productId: 'p_030', qty: 1 }, { productId: 'p_005', qty: 1 },
          { productId: 'p_001', qty: 6 }, { productId: 'p_004', qty: 1 }, { productId: 'p_002', qty: 1 },
          { productId: 'p_020', qty: 1 }, { productId: 'p_021', qty: 1 },
          { productId: 'p_022', qty: 2 }, { productId: 'p_040', qty: 1 }
        ]}
      ],
      services: { 's_pm': { qty: 80 }, 's_super': { qty: 5 }, 's_comm': { qty: 32 }, 's_prog': { qty: 24 }, 's_docs': {}, 's_travel': { rate: 2400 }, 's_ahw': { qty: 16 }, 's_freight': { rate: 1200 } }
    },

    q_2026_0039: {
      mode: 'quick',
      areas: [{
        name: 'Theatre 4 — UC Variation', type: 'Theatre',
        notes: 'Adding video conferencing peripherals to existing theatre, no new display required',
        lines: [
          { productId: 'p_030', qty: 1 }, { productId: 'p_031', qty: 1 }, { productId: 'p_033', qty: 2 }
        ]
      }],
      services: { 's_comm': { qty: 4 }, 's_prog': { qty: 4 } }
    },

    q_2026_0038: {
      areas: [
        { name: 'Council Chamber', type: 'Chamber', notes: '24-seat horseshoe, broadcast-quality audio capture, recorded sessions', lines: [
          { productId: 'p_012', qty: 1 }, { productId: 'p_071', qty: 1 },
          { productId: 'p_005', qty: 4 }, { productId: 'p_001', qty: 8 },
          { productId: 'p_004', qty: 2 }, { productId: 'p_002', qty: 1 },
          { productId: 'p_032', qty: 1, lineNote: 'PTZ camera for broadcast capture' },
          { productId: 'p_080', qty: 6 }, { productId: 'p_050', qty: 2 }
        ]},
        { name: 'Control Room', type: 'Control', notes: 'Rack room behind chamber, redundant control + UPS', lines: [
          { productId: 'p_020', qty: 2 }, { productId: 'p_021', qty: 2 },
          { productId: 'p_022', qty: 6 }, { productId: 'p_040', qty: 2 },
          { productId: 'p_060', qty: 1 }
        ]}
      ],
      services: { 's_pm': { qty: 50 }, 's_super': { qty: 3 }, 's_comm': { qty: 20 }, 's_prog': { qty: 24 }, 's_docs': {}, 's_travel': { rate: 800 }, 's_freight': { rate: 620 } }
    }
  };

  // -------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------
  function productById(id)  { return products.find(p => p.id === id); }
  function supplierById(id) { return suppliers.find(s => s.id === id); }
  function labourForSub(sub){ return labourDefaults[sub] || { hours: 0, trade: 'AV Tech', task: '' }; }
  function rateForTrade(t)  { return labourRates[t] ?? 145; }

  // -------------------------------------------------------------
  // Supplier price-sheet version history (mockup-only seed)
  // Drives the Admin → Products "Import history" modal and the Files tab.
  // Each entry represents a price list imported on a given date with diff stats.
  // -------------------------------------------------------------
  const priceSheetHistory = [
    // Amber Technology — supplier-wide trade list
    { id:'ph_amber_4',  supplierId:'sup_amber',   file:'amber-tradelist-q2-2026.xlsx', uploadedAt:'2026-05-08', uploadedBy:'Steven Carmichael', added:42, updated:188, removed:6,  active:true,  notes:'Q2 trade list — Biamp + Shure increases' },
    { id:'ph_amber_3',  supplierId:'sup_amber',   file:'amber-tradelist-q1-2026.xlsx', uploadedAt:'2026-02-14', uploadedBy:'Steven Carmichael', added:30, updated:151, removed:2,  active:false, notes:'Q1 trade list' },
    { id:'ph_amber_2',  supplierId:'sup_amber',   file:'amber-tradelist-q4-2025.xlsx', uploadedAt:'2025-11-02', uploadedBy:'Mark Stowell',      added:18, updated:97,  removed:0,  active:false, notes:'Q4 2025 trade list — initial import' },
    { id:'ph_amber_1',  supplierId:'sup_amber',   file:'amber-tradelist-q3-2025.xlsx', uploadedAt:'2025-08-19', uploadedBy:'Mark Stowell',      added:240,updated:0,   removed:0,  active:false, notes:'First-ever Amber import' },

    // Rutledge AV — Crestron workbook + ancillary
    { id:'ph_rutl_3',   supplierId:'sup_rutledge',file:'rutledge-crestron-may-2026.xlsx',  uploadedAt:'2026-05-02', uploadedBy:'Steven Carmichael', added:12, updated:88,  removed:1,  active:true,  notes:'Crestron May 2026 — touch panel range update' },
    { id:'ph_rutl_2',   supplierId:'sup_rutledge',file:'rutledge-atlona-feb-2026.xlsx',    uploadedAt:'2026-02-21', uploadedBy:'Mark Stowell',      added:6,  updated:32,  removed:0,  active:false, notes:'Atlona Feb 2026' },
    { id:'ph_rutl_1',   supplierId:'sup_rutledge',file:'rutledge-crestron-jan-2026.xlsx',  uploadedAt:'2026-01-10', uploadedBy:'Steven Carmichael', added:118,updated:0,   removed:0,  active:false, notes:'Crestron starter import' },

    // Hills — Cabling + power
    { id:'ph_hills_2',  supplierId:'sup_hills',   file:'hills-pricelist-apr-2026.csv',  uploadedAt:'2026-04-04', uploadedBy:'Mark Stowell', added:8,  updated:47,  removed:3,  active:true,  notes:'Quarterly update — Cat6A + APC' },
    { id:'ph_hills_1',  supplierId:'sup_hills',   file:'hills-pricelist-jan-2026.csv',  uploadedAt:'2026-01-12', uploadedBy:'Mark Stowell', added:75, updated:0,   removed:0,  active:false, notes:'Initial Hills import' },

    // Madison Technologies — Samsung displays
    { id:'ph_mad_2',    supplierId:'sup_madison', file:'madison-samsung-may-2026.xlsx', uploadedAt:'2026-05-12', uploadedBy:'Steven Carmichael', added:5,  updated:54,  removed:0,  active:true,  notes:'Samsung Q2 RRP refresh' },
    { id:'ph_mad_1',    supplierId:'sup_madison', file:'madison-samsung-feb-2026.xlsx', uploadedAt:'2026-02-09', uploadedBy:'Mark Stowell',      added:42, updated:0,   removed:0,  active:false, notes:'Initial Samsung catalogue' }
  ];

  return {
    suppliers, categories, products, labourDefaults, labourRates, services,
    packages, exclusionsLibrary, standardTerms, sampleQuotes, seedSpecs,
    priceSheetHistory,
    productById, supplierById, labourForSub, rateForTrade
  };
})();
