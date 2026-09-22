# SUNDRIFT — the locked style

> Stylised autumn Japanese mountain-pass objects: clean low-segment geometry with crisp silhouettes and chunky
> proportions, one flat matte colour per part from the palette below, flat shading on foliage and rock, smooth
> shading on painted metal and glass, no glyphs or printed text anywhere, and every member thick enough that
> the object still reads from a chase camera thirty metres away.

Hand this whole file to every agent that generates anything. Do not paraphrase it.

## Palette (exact hex, use these and nothing else)

| role | hex | where it belongs |
|---|---|---|
| asphalt | `0x3a3b40` | road surface, tunnel floor |
| lane white | `0xe8e4da` | road edge lines, painted markings, snow-pole white bands |
| concrete | `0xa8a49c` | tunnel portals, retaining walls, kerbs, bridge parapets, lantern bases |
| galvanised | `0xb9bcc0` | guardrail beams and posts, traffic-mirror pole, lamp-post column |
| warm stone | `0x8a7f72` | boulders, cliff rock, stone lanterns, dry-stone walls |
| dry grass | `0x9a8a3c` | verges, meadow ground, thatch |
| moss green | `0x5f7a3a` | grass in shade, ground cover, moss on stone |
| cedar green | `0x2f5a3a` | cedar / cryptomeria foliage (cool, dark) |
| cedar bark | `0x5a3f2c` | tree trunks, branches, timber posts (unpainted) |
| maple red | `0xc7351f` | maple canopy, variant A |
| maple orange | `0xe07a1a` | maple canopy, variant B |
| maple gold | `0xe8b52a` | maple canopy, variant C; ginkgo |
| vermilion | `0xc9402b` | torii gates, shrine trim, traffic-mirror frame |
| timber | `0x7a5a3a` | huts, fences, bus shelter, painted timber |
| roof tile | `0x4a4f5a` | hut and shrine roofs (dark blue-grey ceramic) |
| pearl white | `0xf2f0ea` | hero car body paint |
| bronze | `0xb8843a` | hero car wheels (deep dish), brass fittings |
| rubber | `0x1a1a1c` | tyres, rubber trim, mirror backs |
| tint glass | `0x1c2a33` | car glass, hut windows |
| lamp warm | `0xffcf7a` | lamp lenses, headlight lenses (emissive) |
| tail red | `0xd11c1c` | car tail-lights, reflectors, red pole bands (emissive on cars) |
| chrome dark | `0x2b2d31` | car underbody, grilles, exhaust tips, wipers, black trim |

## Fixed decisions

- Metres. Hero coupe is 4.45 m long, 1.72 m wide, 1.28 m tall, wheelbase 2.50 m, track 1.50 m, wheel radius
  0.32 m, ground clearance 0.14 m. Maple is 7.0 m tall with a 6.0 m canopy. Cedar is 14 m tall, 4.5 m wide.
  Guardrail post is 0.75 m tall. Lamp post is 6.0 m. Torii is 5.0 m tall and 5.4 m wide. Stone lantern is 1.8 m.
  Boulder is 1.5 m. Snow pole (delineator) is 1.4 m. Traffic mirror is 2.6 m to the top of the mirror.
  Tunnel portal is 9.0 m wide, 6.0 m tall, 3.0 m deep. Mountain hut is 4.0 m wide, 3.6 m tall, 3.0 m deep.
  Vending machine is 1.83 m tall, 1.0 m wide, 0.75 m deep. Chevron sign is 1.8 m tall including its post.
- Base at y = 0, centred on x and z, front faces +Z. A car's nose points +Z. A hut's door faces +Z.
- Flat colours with sensible roughness; surfaces are applied at load time. Foliage, rock and ground use
  `flatShading: true`. Painted metal, glass and concrete use smooth shading.
- Roughness: paint 0.35, glass 0.1 (metalness 0.0), galvanised 0.5 (metalness 0.6), stone 0.95, timber 0.85,
  foliage 0.9, rubber 0.9. Metalness 0 unless stated.
- Material names from the contract's list, not a shortened one:
  `plaster | stone | timber | tile | metal | fabric | foliage | ground`. Name a material only when it is
  truly that substance (stone lantern → `stone`, hut walls → `timber`, roof → `tile`, guardrail → `metal`,
  cedar canopy → `foliage`). Leave car paint, glass and lamp lenses unnamed.
- Emissive: lamp lenses `0xffcf7a` at emissiveIntensity 1.2; car tail-lights `0xd11c1c` at 1.5; car headlight
  lenses `0xfff1d6` at 0.8. Nothing else emits.
- Triangle bands: trees 300 to 1,600 (they are instanced hundreds of times); small props 150 to 2,500;
  set-piece structures 800 to 12,000; hero coupe 9,000 to 30,000. Reduce segment counts at generation, never
  decimate.
- No glyphs, no lettering, no logos, no badges, no number plates with characters, no maker emblems.
  Signage is carried by colour, shape and silhouette only (a yellow board with black chevrons, a red circle).
- Three visual signatures every object over 0.6 m carries: (1) at least one member is a strong dark line
  (rubber, chrome dark or cedar bark) that separates the object from the ground or the sky; (2) exactly one
  accent colour against a dominant colour, both from the table; (3) top silhouettes are stepped or peaked,
  never a plain box, so the object reads against the sky.
- Nothing is thinner than 0.04 m at any scale (a guardrail beam is 0.08 m deep, a mirror pole 0.07 m).
- Trees are three or four overlapping low-segment blobs (icosahedron detail 1, or a lathe of 6 to 8 sides),
  never a single sphere and never leaf cards.
- Every object is recognisable from all four sides. The hero coupe has a modelled rear, underside details are
  hidden, and the interior has a seat, a roll cage bar and a helmeted driver silhouette visible through the
  glass.
