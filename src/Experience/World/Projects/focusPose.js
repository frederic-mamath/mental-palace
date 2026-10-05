import * as THREE from 'three'

// Breakpoint under which the project card becomes a bottom sheet (matches the media query in style.css)
export const narrowViewport = 760

// Camera pose ({ position, target }) looking at a landmark along -normal, sized so `height` world units fill
// a share of the view height, and aimed off-center so the landmark sits beside the project card: left of it
// on wide screens, above it on narrow ones. `elevation` lifts the camera to look slightly down.
// On narrow screens the landmark only gets the top of the view, so the camera backs off much further;
// `narrowHeight` frames a smaller part of it there instead, keeping the camera close (and clear of
// whatever stands behind it).
export function focusPose({ center, normal, right, up, height, narrowHeight = height, elevation = 0 }, { width, height: viewportHeight }, fov) {
  const narrow = width < narrowViewport
  const tanHalfFov = Math.tan(THREE.MathUtils.degToRad(fov / 2))
  const share = narrow ? 0.38 : 0.7
  const distance = (narrow ? narrowHeight : height) / share / (2 * tanHalfFov)
  const visibleHeight = 2 * distance * tanHalfFov
  const visibleWidth = visibleHeight * (width / viewportHeight)

  const target = center.clone()
  if (narrow) target.addScaledVector(up, -visibleHeight * 0.24)
  else target.addScaledVector(right, visibleWidth * 0.2)

  const position = target.clone().addScaledVector(normal, distance).addScaledVector(THREE.Object3D.DEFAULT_UP, distance * elevation)
  return { position, target }
}
