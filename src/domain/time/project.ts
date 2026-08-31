export interface LinearView {
  min: number
  max: number
}

export function projectLinear(year: number, view: LinearView): number {
  return (year - view.min) / (view.max - view.min)
}

export function unprojectLinear(fraction: number, view: LinearView): number {
  return view.min + fraction * (view.max - view.min)
}
