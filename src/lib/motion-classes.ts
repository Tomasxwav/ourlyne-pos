const btnFill =
  'relative isolate overflow-hidden transition-[color,border-color] duration-500 ease-expo before:absolute before:-inset-px before:-z-10 before:translate-y-[105%] before:scale-x-140 before:rounded-[50%_50%_0_0/100%_100%_0_0] before:transition-[translate,scale,border-radius] before:duration-700 before:ease-expo hover:before:translate-y-0 hover:before:scale-x-100 hover:before:rounded-none'

export const btnFillPrimary = `${btnFill} before:bg-gold hover:text-[#111]!`

export const btnFillOutline = `${btnFill} before:bg-foreground hover:text-background! hover:border-foreground!`
