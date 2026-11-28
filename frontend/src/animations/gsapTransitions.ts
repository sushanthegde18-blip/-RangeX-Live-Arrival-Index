import gsap from 'gsap'

export function runStaggerReveal(
  container: HTMLElement | null,
  selector: string,
  reducedMotion: boolean,
): () => void {
  if (!container || reducedMotion) {
    return () => {}
  }

  const ctx = gsap.context(() => {
    gsap.fromTo(
      selector,
      { y: 26, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.85,
        stagger: 0.09,
        ease: 'power3.out',
        clearProps: 'transform',
      },
    )
  }, container)

  return () => ctx.revert()
}

export function tweenNumericValue(
  target: { val: number },
  toValue: number,
  onUpdate: (rounded: number) => void,
  reducedMotion: boolean,
): gsap.core.Tween | null {
  if (reducedMotion) {
    target.val = toValue
    onUpdate(toValue)
    return null
  }
  return gsap.to(target, {
    val: toValue,
    duration: 0.55,
    ease: 'power2.out',
    onUpdate: () => onUpdate(Math.round(target.val)),
  })
}
