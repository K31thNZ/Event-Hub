import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MapPin, Languages, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LanguageUserCardProps {
  person: {
    id: string;
    full_name: string;
    avatar_url: string;
    city: string;
    age_group: string;
    native: string[];
    learning: { code: string; proficiency: string }[];
    interests: string[];
    meeting_types: string[];
    bio: string;
  };
}

// Map language codes to flags/names (simplified)
const languageNames: Record<string, string> = {
  en: "English", ru: "Russian", de: "German", fr: "French", es: "Spanish",
  it: "Italian", pt: "Portuguese", nl: "Dutch", pl: "Polish", sv: "Swedish",
  no: "Norwegian", da: "Danish", fi: "Finnish", cs: "Czech", sk: "Slovak",
  hu: "Hungarian", ro: "Romanian", uk: "Ukrainian", ar: "Arabic", zh: "Chinese",
  ja: "Japanese", ko: "Korean", hi: "Hindi", fa: "Persian", tr: "Turkish",
  he: "Hebrew", el: "Greek", id: "Indonesian", th: "Thai", vi: "Vietnamese",
};

export default function LanguageUserCard({ person }: LanguageUserCardProps) {
  const getInitials = (name: string) => name.substring(0, 2).toUpperCase();

  // Proficiency color mapping
  const getProficiencyColor = (level: string) => {
    switch (level) {
      case "A1": return "bg-gray-200 text-gray-800";
      case "A2": return "bg-blue-100 text-blue-800";
      case "B1": return "bg-green-100 text-green-800";
      case "B2": return "bg-yellow-100 text-yellow-800";
      case "C1": return "bg-pink-100 text-pink-800";
      case "C2": return "bg-purple-100 text-purple-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow duration-300">
      <CardContent className="p-4 space-y-3">
        {/* Header with avatar and name */}
        <div className="flex items-start gap-3">
          <Avatar className="h-12 w-12 border-2 border-primary/20">
            <AvatarImage src={person.avatar_url} alt={person.full_name} />
            <AvatarFallback className="bg-primary/10 text-primary">
              {getInitials(person.full_name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg truncate">{person.full_name}</h3>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="w-3 h-3" />
              <span>{person.city}</span>
              <span className="mx-1">•</span>
              <span>{person.age_group}</span>
            </div>
          </div>
        </div>

        {/* Native languages */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Native</p>
          <div className="flex flex-wrap gap-1">
            {person.native.map(lang => (
              <Badge key={lang} variant="secondary" className="text-xs">
                {languageNames[lang] || lang}
              </Badge>
            ))}
          </div>
        </div>

        {/* Learning languages with proficiency */}
        {person.learning.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Learning</p>
            <div className="flex flex-wrap gap-1.5">
              {person.learning.map(l => (
                <Badge
                  key={l.code}
                  className={`text-xs ${getProficiencyColor(l.proficiency)}`}
                >
                  {languageNames[l.code] || l.code} · {l.proficiency}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Interests (simplified – just first 3) */}
        {person.interests.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Interests</p>
            <div className="flex flex-wrap gap-1">
              {person.interests.slice(0, 3).map(interest => (
                <Badge key={interest} variant="outline" className="text-xs">
                  {interest}
                </Badge>
              ))}
              {person.interests.length > 3 && (
                <Badge variant="outline" className="text-xs">+{person.interests.length - 3}</Badge>
              )}
            </div>
          </div>
        )}

        {/* Bio (truncated) */}
        {person.bio && (
          <p className="text-xs text-muted-foreground line-clamp-2">{person.bio}</p>
        )}

        {/* Connect button */}
        <Button variant="outline" size="sm" className="w-full gap-2 rounded-full">
          <MessageCircle className="w-3 h-3" />
          Connect
        </Button>
      </CardContent>
    </Card>
  );
}
