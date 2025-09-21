// CSS module declarations
declare module '*.css' {
  const content: Record<string, string>;
  export default content;
}

// Image declarations
declare module '*.png' {
  const content: string;
  export default content;
}

declare module '*.jpg' {
  const content: string;
  export default content;
}

declare module '*.jpeg' {
  const content: string;
  export default content;
}

declare module '*.gif' {
  const content: string;
  export default content;
}

declare module '*.svg' {
  const content: React.FunctionComponent<React.SVGProps<SVGSVGElement>>;
  export default content;
}

// Leaflet CSS
declare module 'leaflet/dist/leaflet.css' {
  const content: any;
  export default content;
}