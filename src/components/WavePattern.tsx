import * as React from "react";

interface WavePatternProps {
  className?: string;
}

export const WavePattern: React.FC<WavePatternProps> = ({ className = "" }) => {
  return (
    <figure className={`relative ${className}`} role="img" aria-label="Decorative wave pattern">
      <img
        src="https://api.builder.io/api/v1/image/assets/TEMP/9f348e9cf8fee170c91f7627e17d82a1983883d8?width=1448"
        alt="Abstract wave pattern design"
        className="w-[724px] h-[432px] object-contain relative z-[1] max-md:w-[90%] max-md:max-w-[600px] max-md:h-auto max-md:aspect-[724/432] max-sm:w-[95%] max-sm:max-w-[400px] max-sm:h-auto max-sm:aspect-[724/432]"
        loading="lazy"
      />
    </figure>
  );
};
