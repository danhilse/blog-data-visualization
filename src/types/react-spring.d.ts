import 'react-spring';
import { ReactNode } from 'react';
import { SVGProps } from 'react';

declare module 'react-spring' {
  namespace animated {
    // Specifically target SVG elements
    interface SVGFactory {
      (props: SVGProps<SVGSVGElement> & { children?: ReactNode }): ReactNode;
    }
    
    // Add svg property to the animated namespace
    interface WithAnimated {
      svg: SVGFactory;
    }
    
    // Handle all animated SVG elements
    interface CreateAnimated {
      svg: SVGFactory;
      g: (props: SVGProps<SVGGElement> & { children?: ReactNode }) => ReactNode;
      path: (props: SVGProps<SVGPathElement> & { children?: ReactNode }) => ReactNode;
      circle: (props: SVGProps<SVGCircleElement> & { children?: ReactNode }) => ReactNode;
      rect: (props: SVGProps<SVGRectElement> & { children?: ReactNode }) => ReactNode;
      // Add other SVG elements as needed
    }
  }
}