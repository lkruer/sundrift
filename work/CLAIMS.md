# Claims: what is true of the reference frames

Two reference sets, kept locally for the critic only (never shipped, never copied into the game):

- `work/refs/bar/`: fifteen photographs of Irohazaka (Nikko) and the Hakone Turnpike in autumn daylight, from
  Wikimedia Commons. Used for the daytime phase of the cycle and for the vegetation claims.
- `work/refs/night/`: nine photographs of roads at night under sodium street lamps, from Wikimedia Commons.
  Used for the night phase, which is where every run starts.

Written before the critic round, as statements a machine or a careful eye can check on a frame. Each one
names how a build could satisfy the number and still look wrong.

## Night (the default look)

N1. **One pool of light owns the frame.** Under a lamp the asphalt and the nearest foliage are warm and bright;
    everything more than about twenty metres from a lamp or the headlights falls to a dark cool blue, and the
    far trees are silhouettes. Measured: the brightest 5 percent of the road is at least 4 times the luma of
    the road 40 m away. Gameable by: a black frame with one bright blob. So the dark part must still show shape.
N2. **The sky is a gradient, not a colour.** Deep blue at the zenith, warmer and lighter at the horizon with a
    faint glow; stars visible above. Gameable by: a flat two-tone band. So the gradient must be continuous.
N3. **Two colour temperatures.** The lamp pools and the headlights are warm (B minus R negative by 40 or more
    sRGB units); the moonlit surround is cool (B minus R positive). Gameable by: a global tint. So the pool
    and the surround must differ within one frame.
N4. **The road has sheen.** Lamp light reflects off the asphalt as a stretched highlight toward the camera;
    the road is not a matte grey. Gameable by: painting the road lighter. So the highlight must move with the
    camera.
N5. **Light sources glow.** Lamp lenses, tail lights and reflectors bloom slightly; they read as sources, not
    painted discs. Gameable by: bloom on everything. So diffuse surfaces must not bloom.

## Day (the dawn and golden-hour phases)

1. **The road edge is crowded.** Vegetation reaches to within two metres of the guardrail on both sides for
   most of the frame; there are no bare lawn verges. Gameable by: a wall of identical trees. So the crowd must
   be mixed heights (shrubs, small trees, tall trees).
2. **Foliage is many hues, not one.** In one frame the canopy carries at least five distinct hues: red,
   orange, gold, yellow-green, brown-ochre, with dark evergreen between them. Gameable by: random hue noise
   on one tree. So the hues must come from different trees and shrubs, and red must be a minority.
3. **Two colour temperatures.** Sunlit foliage and asphalt read warm; the shade side of the road, the valley
   and the far ridges read cool blue. Gameable by: a blue tint on the whole frame.
4. **The upper third is full.** Ridges or canopy occupy most of the top third of the frame; the sky is a band,
   not a field. Layers lose contrast with distance (three or more distinct ridge tones).
5. **Long shadows cross the road.** At the golden hour, tree and post shadows lie across the asphalt at a low
   angle and are visibly cooler than the lit road.

## Both

6. **The hero is big and glossy.** In a chase frame the car fills 0.25 to 0.4 of the frame height, its paint
   shows a reflection of the sky or the lamps, the tail lights glow, and the driver is readable.
7. **Speed is visible.** (Eye check, no number.) A frame in motion shows the drift angle, smoke, skid marks
   and the road blurring at the edges of the frame, and never a parked car.
8. **Retro, not rough.** (Eye check.) Shapes are clean and few-faceted, colours are flat and few, edges are
   crisp; nothing reads as noise (no speckled terrain, no jittered silhouettes, no busy textures).
