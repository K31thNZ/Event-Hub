import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateEvent } from "@/hooks/use-events";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Trash2, Plus, CalendarPlus, Image as ImageIcon } from "lucide-react";
import { motion } from "framer-motion";

const createEventSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(10, "Provide a better description"),
  category: z.string().min(1, "Category is required"),
  date: z.coerce.date({ required_error: "Valid date is required" }),
  venueAddress: z.string().min(3, "Address is required"),
  venueCity: z.string().min(2, "City is required"),
  imageUrl: z.string().url("Must be a valid URL").optional().or(z.literal('')),
  ticketTypes: z.array(z.object({
    name: z.string().min(1, "Name required"),
    price: z.coerce.number().min(0, "Price >= 0"),
    quantity: z.coerce.number().min(1, "Quantity > 0"),
    maxPerOrder: z.coerce.number().min(1, "Max > 0")
  })).min(1, "Add at least one ticket type")
});

type FormValues = z.infer<typeof createEventSchema>;

export default function CreateEvent() {
  const [, setLocation] = useLocation();
  const createEvent = useCreateEvent();

  const { register, control, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(createEventSchema),
    defaultValues: {
      ticketTypes: [{ name: "General Admission", price: 0, quantity: 100, maxPerOrder: 5 }]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "ticketTypes"
  });

  const onSubmit = async (data: FormValues) => {
    try {
      await createEvent.mutateAsync({ ...data, published: true } as any);
      setLocation("/dashboard");
    } catch (e) {
      // Error handled
    }
  };

  return (
    <div className="min-h-screen bg-muted/20 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mb-10 text-center">
            <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-primary/10">
              <CalendarPlus className="w-8 h-8" />
            </div>
            <h1 className="text-4xl font-display font-bold mb-4">Host an Event</h1>
            <p className="text-muted-foreground text-lg">Fill in the details to publish your event to the community.</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            <Card className="rounded-3xl border-border/60 shadow-lg overflow-hidden">
              <div className="bg-primary/5 px-8 py-4 border-b border-border/50">
                <h2 className="text-xl font-bold font-display">Basic Information</h2>
              </div>
              <CardContent className="p-8 space-y-6">
                <div className="space-y-2">
                  <Label>Event Title</Label>
                  <Input {...register("title")} className="h-12 rounded-xl text-lg" placeholder="Moscow Summer Tech Mixer" />
                  {errors.title && <p className="text-destructive text-sm">{errors.title.message}</p>}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Input {...register("category")} className="h-12 rounded-xl" placeholder="Networking, Culture..." />
                    {errors.category && <p className="text-destructive text-sm">{errors.category.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Date & Time</Label>
                    <Input {...register("date")} type="datetime-local" className="h-12 rounded-xl" />
                    {errors.date && <p className="text-destructive text-sm">{errors.date.message}</p>}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea {...register("description")} className="rounded-xl min-h-[120px]" placeholder="Tell people what to expect..." />
                  {errors.description && <p className="text-destructive text-sm">{errors.description.message}</p>}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-border/60 shadow-lg overflow-hidden">
              <div className="bg-primary/5 px-8 py-4 border-b border-border/50">
                <h2 className="text-xl font-bold font-display">Location & Media</h2>
              </div>
              <CardContent className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Venue Address</Label>
                    <Input {...register("venueAddress")} className="h-12 rounded-xl" placeholder="Tverskaya St, 1" />
                    {errors.venueAddress && <p className="text-destructive text-sm">{errors.venueAddress.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>City</Label>
                    <Input {...register("venueCity")} className="h-12 rounded-xl" placeholder="Moscow" />
                    {errors.venueCity && <p className="text-destructive text-sm">{errors.venueCity.message}</p>}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><ImageIcon className="w-4 h-4"/> Cover Image URL</Label>
                  <Input {...register("imageUrl")} className="h-12 rounded-xl" placeholder="https://images.unsplash.com/..." />
                  {errors.imageUrl && <p className="text-destructive text-sm">{errors.imageUrl.message}</p>}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-border/60 shadow-lg overflow-hidden">
              <div className="bg-primary/5 px-8 py-4 border-b border-border/50 flex justify-between items-center">
                <h2 className="text-xl font-bold font-display">Tickets</h2>
                <Button type="button" variant="outline" size="sm" onClick={() => append({ name: "", price: 0, quantity: 50, maxPerOrder: 4 })} className="rounded-full bg-white">
                  <Plus className="w-4 h-4 mr-1"/> Add Ticket
                </Button>
              </div>
              <CardContent className="p-8 space-y-6 bg-muted/10">
                {fields.map((field, index) => (
                  <div key={field.id} className="relative bg-card p-6 rounded-2xl border border-border shadow-sm flex flex-col md:flex-row gap-4 items-start md:items-end">
                    {fields.length > 1 && (
                      <button type="button" onClick={() => remove(index)} className="absolute top-4 right-4 text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                    
                    <div className="flex-1 w-full space-y-2">
                      <Label>Ticket Name</Label>
                      <Input {...register(`ticketTypes.${index}.name`)} placeholder="VIP Access" className="h-11 rounded-xl" />
                      {errors.ticketTypes?.[index]?.name && <p className="text-destructive text-xs">{errors.ticketTypes[index].name.message}</p>}
                    </div>
                    
                    <div className="w-full md:w-28 space-y-2">
                      <Label>Price (₽)</Label>
                      <Input type="number" {...register(`ticketTypes.${index}.price`)} className="h-11 rounded-xl" />
                    </div>

                    <div className="w-full md:w-28 space-y-2">
                      <Label>Total Qty</Label>
                      <Input type="number" {...register(`ticketTypes.${index}.quantity`)} className="h-11 rounded-xl" />
                    </div>

                    <div className="w-full md:w-28 space-y-2">
                      <Label>Max / Order</Label>
                      <Input type="number" {...register(`ticketTypes.${index}.maxPerOrder`)} className="h-11 rounded-xl" />
                    </div>
                  </div>
                ))}
                {errors.ticketTypes?.message && <p className="text-destructive text-sm">{errors.ticketTypes.message}</p>}
              </CardContent>
            </Card>

            <div className="pt-6">
              <Button type="submit" disabled={createEvent.isPending} className="w-full h-16 text-xl rounded-2xl shadow-xl shadow-primary/20 hover:shadow-primary/30 hover:-translate-y-1 transition-all">
                {createEvent.isPending ? "Publishing Event..." : "Publish Event"}
              </Button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
