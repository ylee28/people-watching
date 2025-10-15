import * as React from "react";
import { MainLayout } from "@/components/MainLayout";
import { WavePattern } from "@/components/WavePattern";
import { ContactForm } from "@/components/ContactForm";
import { InteractiveCounter } from "@/components/InteractiveCounter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Hero Section with Wave Pattern */}
      <section className="relative" aria-labelledby="hero-title">
        <MainLayout>
          <div className="flex flex-col items-center justify-center space-y-8 p-8">
            <header className="text-center space-y-4 z-10 relative">
              <h1 
                id="hero-title"
                className="text-4xl md:text-6xl font-bold text-gray-900 mb-4"
              >
                Wave Pattern Design
              </h1>
              <p className="text-xl md:text-2xl text-gray-600 max-w-2xl mx-auto">
                Experience beautiful, responsive design with interactive components
              </p>
            </header>
            
            <WavePattern className="z-0" />
          </div>
        </MainLayout>
      </section>

      {/* Interactive Components Section */}
      <section className="py-16 px-4" aria-labelledby="components-title">
        <div className="max-w-6xl mx-auto">
          <header className="text-center mb-12">
            <h2 id="components-title" className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Interactive Components
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Explore our functional UI components built with modern React patterns
            </p>
          </header>

          <Tabs defaultValue="contact" className="w-full">
            <TabsList className="grid w-full grid-cols-3 max-w-md mx-auto mb-8">
              <TabsTrigger value="contact">Contact</TabsTrigger>
              <TabsTrigger value="counter">Counter</TabsTrigger>
              <TabsTrigger value="about">About</TabsTrigger>
            </TabsList>

            <TabsContent value="contact" className="space-y-4">
              <div className="flex justify-center">
                <ContactForm />
              </div>
            </TabsContent>

            <TabsContent value="counter" className="space-y-4">
              <div className="flex justify-center">
                <InteractiveCounter />
              </div>
            </TabsContent>

            <TabsContent value="about" className="space-y-4">
              <div className="flex justify-center">
                <Card className="w-full max-w-2xl mx-auto bg-white/90 backdrop-blur-sm shadow-lg">
                  <CardHeader>
                    <CardTitle className="text-2xl font-bold text-gray-900">About This Project</CardTitle>
                    <CardDescription className="text-gray-600">
                      Built with modern web technologies
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <article className="prose prose-gray max-w-none">
                      <p className="text-gray-700 leading-relaxed">
                        This project showcases a beautiful wave pattern design integrated with 
                        functional React components. It demonstrates responsive design principles, 
                        accessibility best practices, and modern development patterns.
                      </p>
                      
                      <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">
                        Technologies Used
                      </h3>
                      <ul className="list-disc list-inside space-y-2 text-gray-700">
                        <li>React 18 with TypeScript for type-safe development</li>
                        <li>Tailwind CSS for responsive and utility-first styling</li>
                        <li>shadcn/ui for accessible and customizable components</li>
                        <li>React Hook Form with Zod validation for form handling</li>
                        <li>Vite for fast development and optimized builds</li>
                      </ul>

                      <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">
                        Features
                      </h3>
                      <ul className="list-disc list-inside space-y-2 text-gray-700">
                        <li>Fully responsive design that works on all devices</li>
                        <li>Accessible components with proper ARIA attributes</li>
                        <li>Interactive forms with real-time validation</li>
                        <li>Semantic HTML structure for better SEO</li>
                        <li>Modern React patterns with hooks and functional components</li>
                      </ul>
                    </article>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8 px-4" role="contentinfo">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-gray-300">
            © 2024 Wave Pattern Design. Built with React, TypeScript, and Tailwind CSS.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
