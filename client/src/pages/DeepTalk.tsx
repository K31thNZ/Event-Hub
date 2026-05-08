// client/src/pages/DeepTalk.tsx
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DeepTalk() {
  return (
    <div className="min-h-screen bg-muted/20 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <Button asChild variant="ghost" className="gap-2 -ml-2">
            <Link href="/">
              <ArrowLeft className="w-4 h-4" /> Back home
            </Link>
          </Button>
        </div>
        <h1 className="text-3xl font-bold mb-4">DeepTalk</h1>
        <p className="text-muted-foreground">Your new deep conversation experience.</p>
        {/* Add the actual DeepTalk content here */}
      </div>
    </div>
  );
}
