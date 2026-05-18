import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAuthStore } from "@/store/auth.store";
import { useUsers } from "@/hooks/api";
import {
  useMockNotifications,
  useMarkNotifRead,
  useMoveNotificationFolder,
  useComposeNotification,
  useTeamsInteractiveAction,
} from "@/hooks/automation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Mail,
  MessageSquare,
  Inbox,
  Send,
  Trash2,
  AlertTriangle,
  UserCheck,
  CheckCircle,
  Sparkles,
  PenSquare,
  FolderInput,
  FolderPlus,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/notifications")({
  component: NotificationHubPage,
});

const TEMPLATES = {
  email_warning: {
    subject: "⚠️ ACTION REQUIRED: AQH Performance Window Closing Soon",
    body: `<div style="font-family: sans-serif; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; max-width: 600px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05);">
  <h2 style="color: #e11d48; margin-top: 0; font-size: 20px; border-bottom: 2px solid #fda4af; padding-bottom: 8px;">Operational SLA Escalation Notice</h2>
  <p style="font-size: 15px; color: #334155; line-height: 1.6;">Your Q2 goal sheet submission is currently <strong>overdue</strong>. Delay in goal submission holds back team tracking dashboards and review cycles.</p>
  <p style="font-size: 14px; color: #64748b; margin-bottom: 24px;">Please click below to access the performance tracking portal and immediately submit your sheet.</p>
  <div style="text-align: center;">
    <a href="http://localhost:8080/app" style="background-color: #2563eb; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Access Goal Portal</a>
  </div>
</div>`,
  },
  email_checkin: {
    subject: "📅 Scheduler Reminder: Direct Report Q2 Performance Check-in",
    body: `<div style="font-family: sans-serif; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; max-width: 600px;">
  <h2 style="color: #2563eb; margin-top: 0; font-size: 20px; border-bottom: 2px solid #bfdbfe; padding-bottom: 8px;">Manager Action Required</h2>
  <p style="font-size: 15px; color: #334155; line-height: 1.6;">This is an automated system reminder that you have pending quarterly reviews and active check-ins for your direct reports.</p>
  <p style="font-size: 14px; color: #64748b; margin-bottom: 20px;">Please ensure responsiveness scores remain positive by locked action-approvals before the SLA deadline.</p>
  <div style="text-align: center;">
    <a href="http://localhost:8080/app" style="background-color: #1e293b; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">View Team Sheets</a>
  </div>
</div>`,
  },
  teams_card: {
    body: `{
  "type": "AdaptiveCard",
  "version": "1.4",
  "body": [
    {
      "type": "TextBlock",
      "text": "🚨 Escalation: Goal Sheet Review Bottleneck",
      "weight": "Bolder",
      "size": "Medium",
      "color": "Attention"
    },
    {
      "type": "TextBlock",
      "text": "A direct report has a goal sheet pending review for > 5 days. You can review and approve it directly from Microsoft Teams.",
      "wrap": true
    }
  ]
}`,
  },
};

// Dev-only simulate banner dialog
function AdminSimulateBanner({ value, onChange, users }: { value: string; onChange: (v: string) => void; users: any[] }) {
  const [showPopup, setShowPopup] = useState(false);
  const selected = users.find((u) => u.email === value);
  return (
    <div className="flex items-center gap-2 relative">
      <span className="text-[10px] font-bold uppercase tracking-widest text-amber-600 flex items-center gap-1">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
        Dev Simulate Recipient:
      </span>
      <div
        className="relative"
        onMouseEnter={() => setShowPopup(true)}
        onMouseLeave={() => setShowPopup(false)}
      >
        <select
          value={value}
          onFocus={() => setShowPopup(true)}
          onChange={(e) => { onChange(e.target.value); setShowPopup(false); }}
          className="h-8 w-56 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 px-2 text-xs font-medium text-amber-900 dark:text-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-400"
        >
          {users.map((u) => (
            <option key={u.email} value={u.email}>{u.full_name} ({u.role})</option>
          ))}
        </select>
        {showPopup && (
          <div className="absolute right-0 top-10 z-50 w-72 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950 p-4 shadow-2xl text-left">
            <p className="text-xs font-bold text-amber-700 dark:text-amber-300 mb-1">🛠️ Dev-Only Admin Tool</p>
            <p className="text-[11px] text-amber-600 dark:text-amber-400 leading-relaxed">
              This selector impersonates any user's notification inbox. It is <strong>only visible to Admins</strong> and intended for development and QA testing purposes.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function NotificationHubPage() {
  const me = useAuthStore((s) => s.profile);
  const isAdmin = me?.role === "admin";

  const [activeTab, setActiveTab] = useState<"outlook" | "teams">("outlook");
  const [activeFolder, setActiveFolder] = useState<"inbox" | "sent" | "junk" | "deleted">("inbox");
  const [selectedMailId, setSelectedMailId] = useState<string | null>(null);
  // Admin simulate — default to Neha Kapoor
  const [simulatedEmail, setSimulatedEmail] = useState("admin@company.com");

  // Compose Form States
  const [showCompose, setShowCompose] = useState(false);
  const [composeType, setComposeType] = useState("email");
  const [composeRecipient, setComposeRecipient] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");

  // Actual email used to scope data
  const activeEmail = isAdmin ? simulatedEmail : (me?.email ?? "");

  const { data: notifications = [], isLoading } = useMockNotifications(activeEmail);
  const { data: allUsers = [] } = useUsers();

  const markReadMutation = useMarkNotifRead();
  const moveFolderMutation = useMoveNotificationFolder();
  const composeMutation = useComposeNotification();
  const teamsActionMutation = useTeamsInteractiveAction();

  if (!me) return null;

  // Outlook emails vs Teams messages — always scoped to activeEmail
  const emails = notifications.filter((n) => n.type === "email");
  const teamsMessages = notifications.filter((n) => n.type === "teams" && n.recipient_email === activeEmail);

  // Folder filters — use activeEmail for proper sent/inbox scoping
  const filteredEmails = emails.filter((mail) => {
    const isSender = (mail.sender_email ?? "") === activeEmail;
    const isRecipient = mail.recipient_email === activeEmail;
    if (activeFolder === "inbox") return isRecipient && mail.folder === "inbox";
    if (activeFolder === "sent") return isSender && mail.folder !== "deleted";
    if (activeFolder === "junk") return isRecipient && mail.folder === "junk";
    if (activeFolder === "deleted") return mail.folder === "deleted" && (isRecipient || isSender);
    return false;
  });

  const selectedMail = filteredEmails.find((e) => e.id === selectedMailId) ?? filteredEmails[0] ?? null;

  // Folder counts — also use activeEmail
  const inboxCount = emails.filter((e) => e.recipient_email === activeEmail && e.folder === "inbox").length;
  const sentCount = emails.filter((e) => (e.sender_email ?? "") === activeEmail && e.folder !== "deleted").length;
  const junkCount = emails.filter((e) => e.recipient_email === activeEmail && e.folder === "junk").length;
  const deletedCount = emails.filter(
    (e) => e.folder === "deleted" && (e.recipient_email === activeEmail || (e.sender_email ?? "") === activeEmail)
  ).length;

  const handleMarkRead = (id: string) => markReadMutation.mutate(id);

  const handleTeamsCallback = (sheetId: string, action: string) => {
    teamsActionMutation.mutate({ sheet_id: sheetId, action, recipient_email: activeEmail });
  };

  // Sender email for compose is always the real logged-in user (not simulated)
  const realSenderEmail = me?.email ?? "";

  const handleSendCompose = () => {
    if (!composeRecipient) { toast.error("Please select a recipient."); return; }
    if (composeType === "email" && !composeSubject) { toast.error("Please enter a subject."); return; }
    if (!composeBody) { toast.error("Please write a message body."); return; }
    composeMutation.mutate(
      { sender_email: realSenderEmail, recipient_email: composeRecipient, subject: composeType === "email" ? composeSubject : undefined, body: composeBody, type: composeType },
      { onSuccess: () => { setShowCompose(false); setComposeRecipient(""); setComposeSubject(""); setComposeBody(""); setActiveFolder("sent"); } }
    );
  };


  return (
    <div className="flex h-[calc(100vh-6rem)] flex-col space-y-4">
      {/* Top Banner */}
      <div className="flex flex-col justify-between gap-4 border-b pb-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Notification Hub
          </h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin
              ? <>Viewing as: <strong className="text-amber-600">{allUsers.find((u: any) => u.email === simulatedEmail)?.full_name ?? simulatedEmail}</strong> &mdash; Admin simulation mode</>  
              : <>Logged in as: <strong className="text-primary">{me.full_name}</strong></>}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {isAdmin && (
            <AdminSimulateBanner
              value={simulatedEmail}
              onChange={(v) => { setSimulatedEmail(v); setSelectedMailId(null); setActiveFolder("inbox"); }}
              users={allUsers as any[]}
            />
          )}
          <Button onClick={() => setShowCompose(!showCompose)} className="gap-2">
            <PenSquare className="h-4 w-4" /> Compose
          </Button>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => {
            setActiveTab("outlook");
            setShowCompose(false);
          }}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-all ${
            activeTab === "outlook"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Mail className="h-4 w-4" /> Outlook Corporate Email
        </button>
        <button
          onClick={() => {
            setActiveTab("teams");
            setShowCompose(false);
          }}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-all ${
            activeTab === "teams"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <MessageSquare className="h-4 w-4" /> Microsoft Teams Chat ({teamsMessages.length})
        </button>
      </div>

      {/* Main Sandbox Layout */}
      <div className="flex-1 overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
        {isLoading ? (
          <div className="p-8">
            <Skeleton className="h-32 w-full" />
          </div>
        ) : activeTab === "outlook" ? (
          /* =========================================================================
             OUTLOOK PREMIUM THREE-COLUMN INTERFACE
             ========================================================================= */
          <div className="flex h-full divide-x divide-border">
            {/* Outlook Left Column (Folder Bar) */}
            <div className="hidden w-56 bg-muted/20 p-3 lg:block space-y-1 text-left">
              <Button
                variant={activeFolder === "inbox" ? "secondary" : "ghost"}
                onClick={() => {
                  setActiveFolder("inbox");
                  setShowCompose(false);
                }}
                className={`w-full justify-between gap-2 font-medium ${activeFolder === "inbox" ? "text-primary bg-primary/5" : "text-muted-foreground"}`}
              >
                <span className="flex items-center gap-2"><Inbox className="h-4 w-4" /> Inbox</span>
                {inboxCount > 0 && <Badge variant="outline" className="text-[10px] bg-primary/10 border-none">{inboxCount}</Badge>}
              </Button>
              <Button
                variant={activeFolder === "sent" ? "secondary" : "ghost"}
                onClick={() => {
                  setActiveFolder("sent");
                  setShowCompose(false);
                }}
                className={`w-full justify-between gap-2 font-medium ${activeFolder === "sent" ? "text-primary bg-primary/5" : "text-muted-foreground"}`}
              >
                <span className="flex items-center gap-2"><Send className="h-4 w-4" /> Sent Items</span>
                {sentCount > 0 && <Badge variant="outline" className="text-[10px] bg-muted/40 border-none">{sentCount}</Badge>}
              </Button>
              <Button
                variant={activeFolder === "junk" ? "secondary" : "ghost"}
                onClick={() => {
                  setActiveFolder("junk");
                  setShowCompose(false);
                }}
                className={`w-full justify-between gap-2 font-medium ${activeFolder === "junk" ? "text-primary bg-primary/5" : "text-muted-foreground"}`}
              >
                <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Junk Email</span>
                {junkCount > 0 && <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-none">{junkCount}</Badge>}
              </Button>
              <Button
                variant={activeFolder === "deleted" ? "secondary" : "ghost"}
                onClick={() => {
                  setActiveFolder("deleted");
                  setShowCompose(false);
                }}
                className={`w-full justify-between gap-2 font-medium ${activeFolder === "deleted" ? "text-primary bg-primary/5" : "text-muted-foreground"}`}
              >
                <span className="flex items-center gap-2"><Trash2 className="h-4 w-4" /> Deleted Items</span>
                {deletedCount > 0 && <Badge variant="outline" className="text-[10px] bg-rose-500/10 text-rose-600 border-none">{deletedCount}</Badge>}
              </Button>
            </div>

            {/* Outlook Middle Column (Email Cards list) */}
            <div className="w-full overflow-y-auto sm:w-80 lg:w-96 border-r border-border">
              {filteredEmails.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center p-6 text-center">
                  <Mail className="h-8 w-8 text-muted-foreground/60 mb-2" />
                  <p className="text-sm font-medium">Folder is empty</p>
                  <p className="text-xs text-muted-foreground mt-1">No notifications matched this folder scope.</p>
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {filteredEmails.map((mail) => {
                    const isSelected = selectedMail?.id === mail.id;
                    const isUnread = mail.status === "unread";
                    return (
                      <div
                        key={mail.id}
                        onClick={() => {
                          setSelectedMailId(mail.id);
                          setShowCompose(false);
                          if (isUnread) handleMarkRead(mail.id);
                        }}
                        className={`flex flex-col gap-1 p-4 cursor-pointer text-left transition-all ${
                          isSelected ? "bg-primary/5 border-l-4 border-primary" : "hover:bg-muted/30"
                        } ${isUnread ? "font-bold text-foreground" : "text-muted-foreground"}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold truncate text-muted-foreground">
                            {mail.sender_email === me.email ? `To: ${mail.recipient_name}` : mail.sender_name}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {new Date(mail.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {isUnread && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                          <span className="text-sm truncate text-foreground font-medium">{mail.subject}</span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                          {mail.body.replace(/<[^>]*>/g, "").slice(0, 80)}...
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Outlook Right Column (Reading Pane / Compose Screen) */}
            <div className="flex-1 bg-background overflow-y-auto">
              {showCompose ? (
                /* =========================================================================
                   COMPOSE SCREEN
                   ========================================================================= */
                <div className="p-6 space-y-4 text-left max-w-3xl">
                  <div className="flex items-center justify-between border-b pb-3 mb-2">
                    <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                      <PenSquare className="h-5 w-5 text-primary" /> Compose Mock Notification
                    </h2>
                    <Button variant="ghost" size="sm" onClick={() => setShowCompose(false)}>
                      Cancel
                    </Button>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                          Escalation Adapter:
                        </label>
                        <select
                          value={composeType}
                          onChange={(e) => {
                            setComposeType(e.target.value);
                            setComposeSubject("");
                            setComposeBody("");
                          }}
                          className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          <option value="email">Outlook Corporate Email</option>
                          <option value="teams">Microsoft Teams Adaptive Card</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                          Target Recipient:
                        </label>
                        <select
                          value={composeRecipient}
                          onChange={(e) => setComposeRecipient(e.target.value)}
                          className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          <option value="">-- Choose Recipient --</option>
                          {allUsers
                            ?.filter((u: any) => u.email !== me.email)
                            .map((u: any) => (
                              <option key={u.email} value={u.email}>
                                {u.full_name} ({u.role}) - {u.email}
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>

                    {/* Prebuilt Templates Presets */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                        Preset Layout Templates:
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {composeType === "email" ? (
                          <>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => {
                                setComposeSubject(TEMPLATES.email_warning.subject);
                                setComposeBody(TEMPLATES.email_warning.body);
                              }}
                            >
                              ⚠️ Overdue Submission HTML
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => {
                                setComposeSubject(TEMPLATES.email_checkin.subject);
                                setComposeBody(TEMPLATES.email_checkin.body);
                              }}
                            >
                              📅 Manager Check-in HTML
                            </Button>
                          </>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => {
                              setComposeBody(TEMPLATES.teams_card.body);
                            }}
                          >
                            🤖 Actionable Goals Adaptive Card JSON
                          </Button>
                        )}
                      </div>
                    </div>

                    {composeType === "email" && (
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                          Email Subject Line:
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Action Required: Goal sheet overdue notice"
                          value={composeSubject}
                          onChange={(e) => setComposeSubject(e.target.value)}
                          className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                    )}

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                        Template Body Payload (HTML/JSON):
                      </label>
                      <textarea
                        rows={10}
                        placeholder={
                          composeType === "email"
                            ? "Provide HTML warning templates..."
                            : "Provide MS Teams Adaptive Card JSON representation..."
                        }
                        value={composeBody}
                        onChange={(e) => setComposeBody(e.target.value)}
                        className="w-full rounded-md border border-input bg-background p-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>

                    <div className="flex justify-end gap-2 border-t pt-4">
                      <Button variant="outline" onClick={() => setShowCompose(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleSendCompose} disabled={composeMutation.isPending}>
                        {composeMutation.isPending ? "Sending..." : "Send Message"}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : selectedMail ? (
                /* =========================================================================
                   READING PANE DISPLAY
                   ========================================================================= */
                <div className="p-6 text-left">
                  {/* Reading Pane Actions Header */}
                  <div className="flex items-center justify-between border-b pb-4 mb-6">
                    <div className="space-y-1">
                      <h2 className="text-lg font-bold text-foreground leading-tight">{selectedMail.subject}</h2>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">{selectedMail.sender_name}</span>
                        <span>&lt;{selectedMail.sender_email}&gt;</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        To: {selectedMail.recipient_name} ({selectedMail.recipient_email})
                      </div>
                    </div>

                    {/* Action buttons (Move folders) */}
                    <div className="flex items-center gap-2 shrink-0">
                       {selectedMail.folder !== "inbox" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => { moveFolderMutation.mutate({ id: selectedMail.id, folder: "inbox" }); setSelectedMailId(null); }}
                          className="h-8 gap-1.5 text-xs"
                        >
                          <Inbox className="h-3.5 w-3.5" /> Move to Inbox
                        </Button>
                      )}
                      {selectedMail.folder !== "junk" && selectedMail.folder !== "deleted" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => { moveFolderMutation.mutate({ id: selectedMail.id, folder: "junk" }); setSelectedMailId(null); }}
                          className="h-8 gap-1.5 text-xs text-amber-600 border-amber-200 hover:bg-amber-500/10"
                        >
                          <AlertTriangle className="h-3.5 w-3.5" /> Move to Junk
                        </Button>
                      )}
                      {selectedMail.folder !== "deleted" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => { moveFolderMutation.mutate({ id: selectedMail.id, folder: "deleted" }); setSelectedMailId(null); }}
                          className="h-8 gap-1.5 text-xs text-rose-600 border-rose-200 hover:bg-rose-500/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Reading Pane Body */}
                  <div className="rounded-lg border bg-muted/10 p-6 min-h-[300px]">
                    <div
                      className="prose max-w-none text-sm leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: selectedMail.body }}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  <p className="text-sm">Select an email to view its contents</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* =========================================================================
             MICROSOFT TEAMS WORKSPACE SIMULATOR
             ========================================================================= */
          <div className="flex h-full divide-x divide-border bg-[#F3F2F1] dark:bg-[#1f1f1f]">
            {/* Teams Chat List Side panel */}
            <div className="hidden w-64 bg-[#EAEAEA] dark:bg-[#292929] p-3 md:block">
              <div className="mb-4">
                <h3 className="px-2 text-xs font-bold uppercase tracking-wider text-[#616161]">Chats</h3>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-3 rounded-md bg-background px-3 py-2 text-left cursor-pointer shadow-sm border border-border/40">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#6264A7] text-white font-bold text-xs">
                    🤖
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-foreground">SLA Alert Engine</p>
                    <p className="truncate text-[10px] text-muted-foreground">Adaptive Card Dispatched</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Teams Main Chat Feed Workspace */}
            <div className="flex flex-1 flex-col bg-[#F3F2F1] dark:bg-[#1a1a1a] h-full overflow-hidden">
              {/* Teams Top Chat bar */}
              <div className="flex h-12 items-center border-b bg-background px-6 shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="text-sm font-semibold">SLA Alert Engine</span>
                  <Badge className="bg-[#6264A7] text-white hover:bg-[#6264A7] text-[10px]">BOT</Badge>
                </div>
              </div>

              {/* Chat Message feed */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {teamsMessages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-center p-6">
                    <MessageSquare className="h-8 w-8 text-muted-foreground/60 mb-2" />
                    <p className="text-sm font-semibold">No active Teams chats</p>
                    <p className="text-xs text-muted-foreground mt-1">SLA warnings will fire adaptive cards here.</p>
                  </div>
                ) : (
                  <div className="space-y-6 max-w-2xl mx-auto">
                    {teamsMessages.map((msg) => {
                      let cardData: any = null;
                      try {
                        cardData = JSON.parse(msg.body);
                      } catch {
                        cardData = null;
                      }

                      return (
                        <div key={msg.id} className="flex items-start gap-3">
                          {/* Bot Avatar */}
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#6264A7] text-white font-bold text-xs">
                            🤖
                          </div>

                          <div className="space-y-1 w-full max-w-xl">
                            <div className="flex items-baseline gap-2">
                              <span className="text-xs font-semibold">{msg.sender_name}</span>
                              <span className="text-[10px] text-muted-foreground font-mono">
                                {new Date(msg.created_at).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>

                            {/* Render CSS Adaptive Card */}
                            {cardData ? (
                              <div className="rounded-lg border border-border/80 bg-background p-5 shadow-sm text-left relative overflow-hidden group">
                                <div className="absolute top-0 left-0 w-1.5 h-full bg-[#E81123]" />
                                
                                <div className="space-y-4">
                                  {/* Card Text Blocks */}
                                  {cardData.body?.map((block: any, i: number) => {
                                    if (block.type === "TextBlock") {
                                      const isHeader = block.text.includes("🚨") || block.text.includes("💥") || block.text.includes("✅");
                                      return (
                                        <p
                                          key={i}
                                          className={
                                            isHeader
                                              ? "text-base font-bold text-[#E81123]"
                                              : "text-sm text-foreground leading-relaxed"
                                          }
                                        >
                                          {block.text}
                                        </p>
                                      );
                                    } else if (block.type === "FactSet") {
                                      return (
                                        <div key={i} className="rounded-md bg-muted/40 p-3 text-xs space-y-1.5">
                                          {block.facts?.map((fact: any, j: number) => (
                                            <div key={j} className="grid grid-cols-3 gap-2">
                                              <span className="font-semibold text-muted-foreground">{fact.title}:</span>
                                              <span className="col-span-2 text-foreground font-medium">{fact.value}</span>
                                            </div>
                                          ))}
                                        </div>
                                      );
                                    }
                                    return null;
                                  })}

                                  {/* Interactive Submit Actions */}
                                  {msg.interactive_payload && (
                                    <div className="flex items-center gap-2 pt-2">
                                      <Button
                                        onClick={() =>
                                          handleTeamsCallback(msg.interactive_payload?.sheet_id, "approve")
                                        }
                                        className="bg-[#6264A7] text-white hover:bg-[#4F518C] text-xs h-8 px-4"
                                      >
                                        <UserCheck className="mr-1.5 h-3.5 w-3.5" /> Approve Goal Sheet
                                      </Button>
                                      <Button
                                        variant="outline"
                                        onClick={() => handleMarkRead(msg.id)}
                                        className="text-xs h-8 px-4"
                                      >
                                        Dismiss Alert
                                      </Button>
                                    </div>
                                  )}

                                  {/* If already actioned / read */}
                                  {msg.status === "read" && !msg.interactive_payload && (
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
                                      <CheckCircle className="h-4 w-4 text-emerald-500" /> Action completed from adaptive card callback.
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              /* Plain Text message fallback */
                              <div className="rounded-lg bg-background px-4 py-2 text-sm shadow-sm border text-left">
                                {msg.body}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
