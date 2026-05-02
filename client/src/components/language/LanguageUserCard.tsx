// client/src/components/language/LanguageUserCard.tsx
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Languages, MessageCircle } from "lucide-react";
import { LANGUAGES } from "@/lib/constants";

interface LearningLanguage {
  code: string;
  proficiency: string;
}

interface LanguageUser {
  id: string;
  full_name: string;
  avatar_url: string;
  city: string;
  age_group: string;
  native: string[];
  learning: LearningLanguage[];
  interests: string[];
  meeting_types: string[];
  bio: string;
}

interface LanguageUserCardProps {
  person: LanguageUser;
}

// Proficiency colour mapping (from AI version)
const PROFICIENCY_COLORS: Record<string, string> = {
  A1: "bg-slate-100 text-slate-700",
  A2: "bg-blue-100 text-blue-700",
  B1: "bg-emerald-100 text-emerald-700",
  B2: "bg-teal-100 text-teal-700",
  C1: "bg-violet-100 text-violet-700",
  C2: "bg-amber-100 text-amber-700",
};

// Meeting type labels (from AI version)
const MEETING_TYPE_LABELS: Record<string, string> = {
  "1on1": "1 on 1",
  small_group: "Small Group",
  social: "Social Event",
};

function getLangFlag(code: string): string {
  return LANGUAGES.find(l => l.code === code)?.flag ?? "🌐";
}

function getLangLabel(code: string): string {
  return LANGUAGES.find(l => l.code === code)?.label ?? code.toUpperCase();
}

export default function LanguageUserCard({ person }: LanguageUserCardProps) {
  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow duration-200">
      <CardContent className="p-5 space-y-4">
        {/* Header: avatar + name + location */}
        <div className="flex items-start gap-3">
          <Avatar className="h-12 w-12 shrink-0">
            <AvatarImage src={person.avatar_url} alt={person.full_name} />
            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
              {person.full_name.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">{person.full_name}</p>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
              <MapPin className="w-3 h-3 shrink-0" />
              <span>{person.city}</span>
              <span className="mx-1">•</span>
              <span>{person.age_group}</span>
            </div>
          </div>
        </div>

        {/* Bio */}
        {person.bio && (
          <p className="text-sm text-muted-foreground line-clamp-2">{person.bio}</p>
        )}

        {/* Native languages */}
        {person.native.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide flex items-center gap-1">
              <Languages className="w-3 h-3" /> Native
            </p>
            <div className="flex flex-wrap gap-1.5">
              {person.native.map(code => (
                <span
                  key={code}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium"
                >
                  {getLangFlag(code)} {getLangLabel(code)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Learning languages */}
        {person.learning.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Learning</p>
            <div className="flex flex-wrap gap-1.5">
              {person.learning.map(({ code, proficiency }) => (
                <span
                  key={code}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-border text-xs font-medium"
                >
                  {getLangFlag(code)} {getLangLabel(code)}
                  <span className={`ml-1 px-1.5 py-0 rounded-full text-[10px] font-bold ${PROFICIENCY_COLORS[proficiency] ?? "bg-muted text-muted-foreground"}`}>
                    {proficiency}
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Interests (preserved from original) */}
        {person.interests.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Interests</p>
            <div className="flex flex-wrap gap-1.5">
              {person.interests.map(interest => (
                <span
                  key={interest}
                  className="inline-flex items-center px-2 py-0.5 rounded-full bg-muted/50 text-muted-foreground text-xs"
                >
                  #{interest}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Meeting types */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Meeting Style</p>
          <div className="flex flex-wrap gap-1.5">
            {person.meeting_types.map(type => (
              <Badge key={type} variant="secondary" className="text-xs rounded-full">
                {MEETING_TYPE_LABELS[type] ?? type}
              </Badge>
            ))}
          </div>
        </div>

        {/* Connect button */}
        <Button variant="outline" size="sm" className="w-full rounded-xl gap-2 mt-2">
          <MessageCircle className="w-4 h-4" /> Connect
        </Button>
      </CardContent>
    </Card>
  );
}
