// client/src/components/language/LanguageUserCard.tsx
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MapPin, Languages, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LANGUAGES, PROFICIENCY_LEVELS } from "@/lib/constants";

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

export default function LanguageUserCard({ person }: LanguageUserCardProps) {
  const getLanguageLabel = (code: string) => {
    const lang = LANGUAGES.find(l => l.code === code);
    return lang ? `${lang.flag} ${lang.label}` : code;
  };

  const getProficiencyLabel = (level: string) => {
    const prof = PROFICIENCY_LEVELS.find(p => p.value === level);
    return prof ? prof.label : level;
  };

  const getInitials = (name: string) => {
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow duration-200">
      <CardContent className="p-4 space-y-3">
        {/* Header with avatar and name */}
        <div className="flex items-start gap-3">
          <Avatar className="h-12 w-12 ring-2 ring-primary/20">
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

        {/* Native language */}
        <div className="flex flex-wrap gap-1">
          <Badge variant="outline" className="bg-primary/5">
            <Languages className="w-3 h-3 mr-1" />
            Native: {person.native.map(getLanguageLabel).join(", ")}
          </Badge>
        </div>

        {/* Learning languages */}
        {person.learning.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {person.learning.map(lang => (
              <Badge key={lang.code} variant="secondary" className="text-xs">
                Learning {getLanguageLabel(lang.code)} ({getProficiencyLabel(lang.proficiency)})
              </Badge>
            ))}
          </div>
        )}

        {/* Interests */}
        {person.interests.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {person.interests.map(interest => (
              <Badge key={interest} variant="outline" className="text-xs">
                #{interest}
              </Badge>
            ))}
          </div>
        )}

        {/* Meeting types */}
        <div className="flex flex-wrap gap-1">
          {person.meeting_types.map(type => (
            <Badge key={type} className="bg-primary/10 text-primary hover:bg-primary/20">
              {type === "1on1" ? "1 on 1" : type === "small_group" ? "Small Group" : "Social Event"}
            </Badge>
          ))}
        </div>

        {/* Bio */}
        {person.bio && (
          <p className="text-sm text-muted-foreground line-clamp-2">{person.bio}</p>
        )}

        {/* Action button */}
        <Button variant="outline" size="sm" className="w-full gap-2">
          <MessageCircle className="w-4 h-4" />
          Connect
        </Button>
      </CardContent>
    </Card>
  );
}
