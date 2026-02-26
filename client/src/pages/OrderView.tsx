import { useParams, Link } from "wouter";
import { useOrder } from "@/hooks/use-orders";
import { format } from "date-fns";
import { ArrowLeft, Download, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { QrCode } from "lucide-react"; // using lucide as mock qr

export default function OrderView() {
  const { id } = useParams();
  const { data: order, isLoading } = useOrder(Number(id));

  const handleDownload = async () => {
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const element = document.getElementById('ticket-pdf');
      html2pdf().set({
        margin: [0.5, 0.5],
        filename: `ticket-${order?.id}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' }
      }).from(element).save();
    } catch (err) {
      console.error('Failed to generate PDF', err);
    }
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  if (!order) return <div className="text-center py-32"><h2 className="text-3xl font-display font-bold">Order not found</h2></div>;

  return (
    <div className="min-h-screen bg-muted/30 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        
        <Link href="/dashboard" className="inline-flex items-center text-muted-foreground hover:text-primary mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
        </Link>

        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center mb-12">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-green-500/20">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h1 className="text-3xl md:text-5xl font-display font-bold mb-4">You're going to {order.event.title}!</h1>
          <p className="text-muted-foreground text-lg">Your order #{order.id} is confirmed.</p>
        </motion.div>

        {/* The Ticket Container */}
        <div id="ticket-pdf" className="bg-card rounded-[2rem] overflow-hidden shadow-2xl flex flex-col md:flex-row relative border border-border/50">
          
          {/* Ticket Body */}
          <div className="p-8 md:p-12 md:w-2/3 border-b md:border-b-0 md:border-r border-dashed border-border/80 relative bg-white">
            {/* Cutouts */}
            <div className="absolute -top-6 -right-6 w-12 h-12 bg-muted/30 rounded-full border-b border-l border-border/50 hidden md:block" />
            <div className="absolute -bottom-6 -right-6 w-12 h-12 bg-muted/30 rounded-full border-t border-l border-border/50 hidden md:block" />

            <div className="inline-flex px-3 py-1 rounded-md bg-primary/10 text-primary font-bold text-xs tracking-widest uppercase mb-6">
              VIP Admission
            </div>
            
            <h2 className="font-display text-4xl font-bold text-foreground mb-3 leading-tight">{order.event.title}</h2>
            <p className="text-muted-foreground mb-10 text-lg">{order.event.venueAddress}, {order.event.venueCity}</p>
            
            <div className="grid grid-cols-2 gap-8 mb-8">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1 font-bold">Date & Time</p>
                <p className="font-semibold text-lg">{format(new Date(order.event.date), 'MMM d, yyyy')}</p>
                <p className="text-muted-foreground">{format(new Date(order.event.date), 'h:mm a')}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1 font-bold">Attendee</p>
                <p className="font-semibold text-lg">{order.attendeeName}</p>
                <p className="text-muted-foreground truncate">{order.attendeeEmail}</p>
              </div>
            </div>
            
            <div className="border-t border-border/50 pt-6">
              <p className="text-xs text-muted-foreground uppercase tracking-widest mb-3 font-bold">Tickets Included</p>
              {order.tickets.map(t => (
                <div key={t.id} className="flex justify-between font-medium text-lg mb-2">
                  <span><span className="text-primary font-bold mr-2">{t.quantity}x</span> {t.ticketType.name}</span>
                </div>
              ))}
            </div>
          </div>
          
          {/* Ticket Stub / QR */}
          <div className="p-8 md:w-1/3 bg-primary/[0.03] flex flex-col items-center justify-center text-center relative">
            <QrCode className="w-40 h-40 text-primary/80 mb-6" strokeWidth={1} />
            <p className="font-mono text-sm tracking-[0.25em] text-muted-foreground mb-4">#{order.id.toString().padStart(8, '0')}</p>
            <div className="w-full py-3 border-y border-dashed border-primary/20 text-primary font-bold tracking-widest uppercase text-sm">
              Valid Ticket
            </div>
          </div>
        </div>

        <div className="mt-12 flex justify-center">
          <Button onClick={handleDownload} size="lg" className="rounded-full px-8 h-14 text-lg shadow-xl shadow-primary/20 gap-2">
            <Download className="w-5 h-5" /> Download PDF Ticket
          </Button>
        </div>

      </div>
    </div>
  );
}
