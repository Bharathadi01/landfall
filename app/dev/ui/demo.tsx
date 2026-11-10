"use client";

import React, { useState } from "react";
import { Button, GlassPane, Tag, SegmentedTabs, LowerThird, NewsCrawl, LiveClock, Kbd, Tooltip, SectionHeading, StatCard, PageHeader, Dialog, Field, Input, Select } from "@/components/ui";
import { ProvenanceTag, PayPalStatusBadge } from "@/components/relief/parts";

export function UiKitDemo() {
  const [tab, setTab] = useState<"obs" | "fc" | "wind">("obs");
  const [open, setOpen] = useState(false);
  return (
    <main className="mx-auto max-w-6xl space-y-14 px-6 py-16">
      <PageHeader eyebrow="Design system" title="Broadcast desk" accent="components" description="Living style guide — development only." actions={<LiveClock local />} />

      <section className="space-y-5">
        <SectionHeading eyebrow="Buttons" title="Liquid glass," accent="five voices." />
        <div className="flex flex-wrap items-center gap-4">
          <Button variant="signal" size="lg" magnetic refract>Watch a live response</Button>
          <Button variant="glass" size="lg" refract>Open Command Center</Button>
          <Button variant="signal">Approve payout</Button>
          <Button variant="glass">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="paypal">Pay with PayPal</Button>
          <Button variant="danger">Stop all payouts</Button>
          <Button variant="glass" size="sm">Small</Button>
          <Button variant="glass" loading>Loading</Button>
          <Button variant="glass" disabled>Disabled</Button>
          <Button variant="glass" iconOnly aria-label="Example">★</Button>
          <Button variant="ghost" href="/console/war-room">As link</Button>
        </div>
      </section>

      <section className="space-y-5">
        <SectionHeading eyebrow="Tags" title="On-air labels" />
        <div className="flex flex-wrap items-center gap-3">
          <Tag tone="accent" solid live>Live</Tag>
          <Tag tone="storm" solid>Replay</Tag>
          <Tag tone="paypal" solid>Sandbox</Tag>
          <Tag tone="money">$500.00</Tag>
          <Tag tone="delivered">Delivered</Tag>
          <Tag tone="ai">AI · read-only</Tag>
          <Tag tone="amber">Reserve</Tag>
          <Tag tone="danger">Failed</Tag>
          <Tag>Neutral</Tag>
          <PayPalStatusBadge status="UNCLAIMED" />
          <PayPalStatusBadge status="SUCCESS" />
          <ProvenanceTag provenance="PROVIDER" />
          <ProvenanceTag provenance="RECIPIENT_REPORTED" />
          <Kbd>⌘K</Kbd>
          <Tooltip content="Provider evidence, not proof of receipt"><span className="text-sm text-ink-2 underline decoration-dotted">hover me</span></Tooltip>
        </div>
      </section>

      <section className="space-y-5">
        <SectionHeading eyebrow="Panes & stats" title="Frosted glass" />
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard label="Households in path" value={8} tone="storm" hint="Inside the forecast cone" />
          <StatCard label="Relief reserved" value={500} prefix="$" tone="money" hint="Across five recipients" />
          <StatCard label="Delivered" value={3} suffix=" / 8" tone="delivered" hint="Confirmed by PayPal" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <GlassPane level={1}>Level 1 — in-page card</GlassPane>
          <GlassPane level={2}>Level 2 — raised panel</GlassPane>
          <GlassPane level={3}>Level 3 — HUD overlay</GlassPane>
        </div>
      </section>

      <section className="space-y-5">
        <SectionHeading eyebrow="Navigation" title="Tabs, lower third, crawl" />
        <SegmentedTabs ariaLabel="Timeline" value={tab} onChange={setTab} tabs={[{ id: "obs", label: "Observed" }, { id: "fc", label: "Forecast", count: 48 }, { id: "wind", label: "Wind" }]} />
        <div><LowerThird kicker="Hurricane warning" title="Milton · Category 3" meta="Tampa Bay · landfall in 12 h · NWS" tone="storm" /></div>
        <GlassPane level={1} padded={false} className="py-3"><NewsCrawl items={[{ id: "1", label: "NWS", tone: "storm", text: "Hurricane Warning for Pinellas County" }, { id: "2", label: "PayPal", tone: "paypal", text: "Batch created in Sandbox" }, { id: "3", label: "AI", tone: "ai", text: "No duplicate recipients found" }]} /></GlassPane>
      </section>

      <section className="space-y-5">
        <SectionHeading eyebrow="Forms & dialog" title="Fields" />
        <div className="grid max-w-xl gap-4">
          <Field label="Household name" hint="As it appears on the enrollment">{(a) => <Input placeholder="Rivera family" {...a} />}</Field>
          <Field label="Zone">{(a) => <Select {...a}><option>A</option><option>B</option></Select>}</Field>
          <div><Button variant="glass" onClick={() => setOpen(true)}>Open dialog</Button></div>
        </div>
        <Dialog open={open} onClose={() => setOpen(false)} title="Approve this payout?" description="Two people must approve before PayPal is called." footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button variant="signal" onClick={() => setOpen(false)}>Approve</Button></>} />
      </section>
    </main>
  );
}
