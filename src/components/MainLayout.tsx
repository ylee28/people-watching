import * as React from "react";

interface MainLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children, className = "" }) => {
  return (
    <main 
      className={`max-w-none w-full h-screen min-h-[600px] bg-white relative overflow-hidden flex items-center justify-center mx-auto max-md:max-w-[991px] max-sm:max-w-screen-sm ${className}`}
      role="main"
    >
      {children}
    </main>
  );
};
