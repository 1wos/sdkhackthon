declare module "html2canvas-pro" {
  interface Html2CanvasOptions {
    scale?: number;
    useCORS?: boolean;
    logging?: boolean;
    backgroundColor?: string;
    width?: number;
    height?: number;
    windowWidth?: number;
    windowHeight?: number;
    x?: number;
    y?: number;
  }

  function html2canvas(
    element: HTMLElement,
    options?: Html2CanvasOptions
  ): Promise<HTMLCanvasElement>;

  export default html2canvas;
}
