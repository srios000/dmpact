import { createHash, randomBytes } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import { runPostChecks } from "@/lib/ai/extract/post-checks";
import { withComputedAmounts } from "@/lib/money/agreement";
import type { Agreement, ServiceType } from "@/lib/schema/agreement";
import { contentHash } from "@/lib/schema/content-hash";
import type { CommissionState } from "@/lib/state-machine/rules";

type InvoicePlan = "sent" | "paid" | "overdue";

type DemoSpec = {
  state: CommissionState;
  createdDaysAgo: number;
  service: ServiceType;
  title: string;
  dm: string;
  client: { name: string; handle: string; email: string | null };
  deliverables: { description: string; quantity?: number; format?: string }[];
  total: string | null;
  deposit: Agreement["deposit"]["type"];
  depositValue?: number | string;
  deadlineInDays: number | null;
  revisions: number | null;
  commercial: boolean;
  credit: boolean;
  changeRequest?: string;
  depositInvoice?: InvoicePlan;
  balanceInvoice?: InvoicePlan;
  finalFile?: { filename: string; mimeType: string; sizeBytes: number };
};

export type SeededCommission = {
  id: string;
  title: string;
  state: CommissionState;
  clientToken: string | null;
};

const DAY = 24 * 60 * 60 * 1000;

function demoToken(creatorId: string, title: string): string {
  return createHash("sha256")
    .update(`demo:${creatorId}:${title}`)
    .digest()
    .subarray(0, 16)
    .toString("base64url");
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function demoSpecs(clientPaypalEmail: string): DemoSpec[] {
  return [
    {
      state: "draft",
      createdDaysAgo: 0,
      service: "live2d_rigging",
      title: "Live2D rigging for Kirana's debut model",
      dm: "halo kak, aku Kirana! mau rigging model live2d buat debut aku. artnya udah jadi, PSD-nya rapi. budget sama tanggalnya nanti aku kabarin ya, masih nunggu dana cair hehe",
      client: { name: "Kirana Aoi", handle: "@kirana_aoi", email: null },
      deliverables: [{ description: "Live2D rig with face and body tracking" }],
      total: null,
      deposit: "percent",
      depositValue: 50,
      deadlineInDays: null,
      revisions: 2,
      commercial: true,
      credit: true,
    },
    {
      state: "draft",
      createdDaysAgo: 1,
      service: "thumbnail",
      title: "Thumbnail pack for weekly karaoke streams",
      dm: "hi! could you make 4 karaoke stream thumbnails? same layout each week, just swap the song title. $60 for all 4, due in 10 days. commercial use since streams are monetized. credit in description is fine",
      client: {
        name: "Mochi Lune",
        handle: "@mochilune",
        email: "mochi.lune@example.com",
      },
      deliverables: [
        {
          description: "Karaoke stream thumbnail",
          quantity: 4,
          format: "PNG 1280x720",
        },
      ],
      total: "60.00",
      deposit: "percent",
      depositValue: 50,
      deadlineInDays: 10,
      revisions: 1,
      commercial: true,
      credit: true,
    },
    {
      state: "negotiating",
      createdDaysAgo: 2,
      service: "illustration",
      title: "Debut key visual illustration",
      dm: "kak aku mau commission key visual buat debut aku, full body + background simple. $120 ya, DP 50%. deadline 3 minggu lagi. boleh dipake buat merch juga (commercial), credit di bio aja. revisi 2x",
      client: {
        name: "Sora Hikari",
        handle: "@sorahikari_vt",
        email: clientPaypalEmail,
      },
      deliverables: [
        {
          description: "Full-body key visual with simple background",
          format: "PNG 4000px",
        },
        { description: "Layered source file", format: "PSD" },
      ],
      total: "120.00",
      deposit: "percent",
      depositValue: 50,
      deadlineInDays: 21,
      revisions: 2,
      commercial: true,
      credit: true,
    },
    {
      state: "negotiating",
      createdDaysAgo: 3,
      service: "mix_and_master",
      title: "Cover song mix and master",
      dm: "kak mau mix & master cover lagu, vocal 1 track + 2 harmoni, instrumentnya udah ada. $90, DP 30%. butuh 2 minggu lagi buat upload. buat youtube channel aku yang udah monet",
      client: {
        name: "Rei Kanade",
        handle: "@reikanade",
        email: "rei.kanade@example.com",
      },
      deliverables: [
        {
          description: "Mix (vocal, 2 harmonies, instrumental)",
          format: "WAV 48kHz/24bit",
        },
        { description: "Master for streaming", format: "WAV + MP3 320" },
      ],
      total: "90.00",
      deposit: "percent",
      depositValue: 30,
      deadlineInDays: 14,
      revisions: 2,
      commercial: true,
      credit: false,
      changeRequest:
        "Bisa tambah 1 revisi lagi ga kak? Takut harmoninya masih perlu diatur.",
    },
    {
      state: "agreed",
      createdDaysAgo: 4,
      service: "illustration",
      title: "Emote set for membership tiers",
      dm: "need 6 emotes for my membership tiers, chibi style. $72 total, 50% upfront. 12 days ok? commercial use since they're for members, credit not needed",
      client: {
        name: "Juniper Vale",
        handle: "@junipervale",
        email: "juniper.vale@example.com",
      },
      deliverables: [
        { description: "Chibi emote", quantity: 6, format: "PNG 112/56/28px" },
      ],
      total: "72.00",
      deposit: "percent",
      depositValue: 50,
      deadlineInDays: 12,
      revisions: 1,
      commercial: true,
      credit: false,
      depositInvoice: "sent",
    },
    {
      state: "dp_paid",
      createdDaysAgo: 6,
      service: "illustration",
      title: "Channel banner and info panels",
      dm: "hello! banner youtube + 4 panel info twitch ya kak, tema pastel. $80, DP $30. 2 minggu. commercial ok, credit di about",
      client: {
        name: "Hana Mirai",
        handle: "@hanamirai",
        email: "hana.mirai@example.com",
      },
      deliverables: [
        { description: "YouTube banner", format: "PNG 2560x1440" },
        {
          description: "Twitch info panel",
          quantity: 4,
          format: "PNG 320x160",
        },
      ],
      total: "80.00",
      deposit: "fixed",
      depositValue: "30.00",
      deadlineInDays: 8,
      revisions: 2,
      commercial: true,
      credit: true,
      depositInvoice: "paid",
    },
    {
      state: "in_progress",
      createdDaysAgo: 9,
      service: "mv_editing",
      title: "MV editing for original song",
      dm: "mau edit MV lagu original aku, footage live2d udah di-record, 3 menit. $200, DP 50%, deadline 10 hari lagi. commercial, credit di deskripsi",
      client: {
        name: "Aster Nightingale",
        handle: "@asternight",
        email: "aster.night@example.com",
      },
      deliverables: [
        { description: "Edited music video, 3 minutes", format: "MP4 1080p" },
      ],
      total: "200.00",
      deposit: "percent",
      depositValue: 50,
      deadlineInDays: 10,
      revisions: 2,
      commercial: true,
      credit: true,
      depositInvoice: "paid",
    },
    {
      state: "in_progress",
      createdDaysAgo: 12,
      service: "illustration",
      title: "Character reference sheet",
      dm: "can you draw a ref sheet for my new outfit? front + back + 3 expressions. $110, half upfront, due in a week. personal use only, no credit needed",
      client: {
        name: "Pip Marlowe",
        handle: "@pipmarlowe",
        email: "pip.marlowe@example.com",
      },
      deliverables: [
        { description: "Reference sheet, front and back", format: "PNG" },
        { description: "Expression sketches", quantity: 3, format: "PNG" },
      ],
      total: "110.00",
      deposit: "percent",
      depositValue: 50,
      deadlineInDays: 7,
      revisions: 1,
      commercial: false,
      credit: false,
      depositInvoice: "paid",
    },
    {
      state: "delivered",
      createdDaysAgo: 15,
      service: "illustration",
      title: "Anniversary stream overlay",
      dm: "overlay buat 1st anniversary stream: frame kamera, chat box, sama starting soon screen. $95, DP 50%. commercial, credit di panel",
      client: {
        name: "Luna Corvid",
        handle: "@lunacorvid",
        email: "luna.corvid@example.com",
      },
      deliverables: [
        {
          description: "Camera frame, chat box and starting-soon screen",
          format: "PNG + PSD",
        },
      ],
      total: "95.00",
      deposit: "percent",
      depositValue: 50,
      deadlineInDays: -2,
      revisions: 2,
      commercial: true,
      credit: true,
      depositInvoice: "paid",
      balanceInvoice: "sent",
    },
    {
      state: "delivered",
      createdDaysAgo: 25,
      service: "mv_editing",
      title: "Lyric video for cover song",
      dm: "lyric video simple buat cover aku, 4 menit, font sama warna ikut thumbnail. $70, DP 50%. commercial, credit di deskripsi",
      client: {
        name: "Ember Quill",
        handle: "@emberquill",
        email: "ember.quill@example.com",
      },
      deliverables: [
        { description: "Lyric video, 4 minutes", format: "MP4 1080p" },
      ],
      total: "70.00",
      deposit: "percent",
      depositValue: 50,
      deadlineInDays: -12,
      revisions: 1,
      commercial: true,
      credit: true,
      depositInvoice: "paid",
      balanceInvoice: "overdue",
    },
    {
      state: "fully_paid",
      createdDaysAgo: 30,
      service: "illustration",
      title: "Birthday stream illustration",
      dm: "ilustrasi ultah aku buat stream, half body pakai outfit ultah. $85, DP 50%. commercial, credit di tweet",
      client: {
        name: "Nova Seren",
        handle: "@novaseren",
        email: "nova.seren@example.com",
      },
      deliverables: [
        {
          description: "Half-body birthday illustration",
          format: "PNG 3000px",
        },
      ],
      total: "85.00",
      deposit: "percent",
      depositValue: 50,
      deadlineInDays: -18,
      revisions: 2,
      commercial: true,
      credit: true,
      depositInvoice: "paid",
      balanceInvoice: "paid",
      finalFile: {
        filename: "nova-birthday-final.png",
        mimeType: "image/png",
        sizeBytes: 6_482_311,
      },
    },
    {
      state: "cancelled",
      createdDaysAgo: 20,
      service: "mastering",
      title: "EP mastering, 4 tracks",
      dm: "mastering 4 lagu buat EP, $160. deadline akhir bulan. commercial",
      client: {
        name: "Indigo Rhee",
        handle: "@indigorhee",
        email: "indigo.rhee@example.com",
      },
      deliverables: [
        { description: "Mastered track", quantity: 4, format: "WAV + MP3 320" },
      ],
      total: "160.00",
      deposit: "percent",
      depositValue: 50,
      deadlineInDays: -5,
      revisions: 1,
      commercial: true,
      credit: false,
    },
  ];
}

const PATH: CommissionState[] = [
  "draft",
  "negotiating",
  "agreed",
  "dp_paid",
  "in_progress",
  "delivered",
  "fully_paid",
];

const ACTORS: Partial<
  Record<CommissionState, "creator" | "client" | "paypal">
> = {
  negotiating: "creator",
  agreed: "client",
  dp_paid: "paypal",
  in_progress: "creator",
  delivered: "creator",
  fully_paid: "paypal",
};

function buildAgreement(spec: DemoSpec, now: Date): Agreement {
  const created = new Date(now.getTime() - spec.createdDaysAgo * DAY);
  const deadline =
    spec.deadlineInDays === null
      ? null
      : isoDate(new Date(now.getTime() + spec.deadlineInDays * DAY));
  const draft: Agreement = {
    schema_version: "1.0",
    service_type: spec.service,
    service_other: null,
    title: spec.title,
    deliverables: spec.deliverables.map((d, i) => ({
      id: `d${i + 1}`,
      description: d.description,
      quantity: d.quantity ?? 1,
      ...(d.format ? { format: d.format } : {}),
    })),
    price: { total: spec.total, currency: "USD" },
    deposit: {
      type: spec.deposit,
      percent: spec.deposit === "percent" ? Number(spec.depositValue) : null,
      fixed_amount: spec.deposit === "fixed" ? String(spec.depositValue) : null,
    },
    deadline: { date: deadline, raw_text: deadline, is_relative: false },
    revisions: { included: spec.revisions },
    usage_rights: {
      commercial: spec.commercial,
      credit_required: spec.credit,
      notes: null,
    },
    parties: {
      client: {
        display_name: spec.client.name,
        handle: spec.client.handle,
        email: spec.client.email,
      },
    },
    notes: null,
    ambiguities: [],
  };
  return withComputedAmounts(
    runPostChecks({
      agreement: draft,
      dmText: spec.dm,
      pasteDate: isoDate(created),
    }),
  );
}

function statesUpTo(target: CommissionState): CommissionState[] {
  if (target === "cancelled") return ["draft", "negotiating", "cancelled"];
  return PATH.slice(0, PATH.indexOf(target) + 1);
}

export async function resetDemoCommissions(
  db: PrismaClient,
  creatorId: string,
  clientPaypalEmail: string,
) {
  await clearDemoCommissions(db, creatorId);
  return seedDemoCommissions(db, creatorId, clientPaypalEmail);
}

export async function seedDemoCommissions(
  db: PrismaClient,
  creatorId: string,
  clientPaypalEmail: string,
  now = new Date(),
) {
  const seeded: SeededCommission[] = [];
  for (const spec of demoSpecs(clientPaypalEmail)) {
    const agreement = buildAgreement(spec, now);
    const hash = contentHash(agreement);
    const states = statesUpTo(spec.state);
    const sent = states.includes("negotiating");
    const agreed = states.includes("agreed");
    const blockers = agreement.ambiguities.filter(
      (a) => a.severity === "blocker",
    );
    if (sent && blockers.length > 0) {
      throw new Error(`"${spec.title}" has blockers but is past draft.`);
    }

    const start = now.getTime() - spec.createdDaysAgo * DAY;
    const at = (step: number) => new Date(start + step * 6 * 60 * 60 * 1000);

    const commission = await db.commission.create({
      data: {
        creatorId,
        state: spec.state,
        sourceDm: spec.dm,
        clientToken: sent ? demoToken(creatorId, spec.title) : null,
        createdAt: at(0),
      },
    });
    seeded.push({
      id: commission.id,
      title: spec.title,
      state: spec.state,
      clientToken: commission.clientToken,
    });
    const version = await db.agreementVersion.create({
      data: {
        commissionId: commission.id,
        version: 1,
        content: agreement,
        contentHash: hash,
        createdBy: "creator",
        createdAt: at(0),
      },
    });

    if (sent) {
      await db.confirmation.create({
        data: {
          commissionId: commission.id,
          agreementVersionId: version.id,
          party: "creator",
          contentHash: hash,
          confirmedAt: at(1),
        },
      });
    }
    if (agreed) {
      await db.confirmation.create({
        data: {
          commissionId: commission.id,
          agreementVersionId: version.id,
          party: "client",
          contentHash: hash,
          confirmedAt: at(2),
        },
      });
    }

    await db.commissionEvent.create({
      data: {
        commissionId: commission.id,
        type: "created",
        toState: "draft",
        actor: "creator",
        at: at(0),
      },
    });
    for (let i = 1; i < states.length; i++) {
      await db.commissionEvent.create({
        data: {
          commissionId: commission.id,
          type: "transition",
          fromState: states[i - 1],
          toState: states[i],
          actor: states[i] === "cancelled" ? "creator" : ACTORS[states[i]]!,
          at: at(i),
        },
      });
    }

    if (spec.changeRequest) {
      await db.changeRequest.create({
        data: {
          commissionId: commission.id,
          version: 1,
          message: spec.changeRequest,
          createdAt: at(2),
        },
      });
      await db.commissionEvent.create({
        data: {
          commissionId: commission.id,
          type: "change_requested",
          actor: "client",
          at: at(2),
        },
      });
    }

    const invoice = async (
      kind: "deposit" | "balance",
      plan: InvoicePlan,
      amount: string,
      step: number,
    ) => {
      const due =
        plan === "overdue"
          ? new Date(now.getTime() - 5 * DAY)
          : new Date(at(step).getTime() + 7 * DAY);
      await db.invoice.create({
        data: {
          commissionId: commission.id,
          kind,
          status: plan === "paid" ? "paid" : "sent",
          amount,
          currency: "USD",
          dueDate: new Date(`${isoDate(due)}T00:00:00Z`),
          paidAt: plan === "paid" ? at(step + 1) : null,
          createdAt: at(step),
        },
      });
    };

    if (spec.depositInvoice && agreement.deposit.amount) {
      await invoice(
        "deposit",
        spec.depositInvoice,
        agreement.deposit.amount,
        2,
      );
    }
    if (spec.balanceInvoice && agreement.balance_amount) {
      await invoice(
        "balance",
        spec.balanceInvoice,
        agreement.balance_amount,
        states.indexOf("delivered"),
      );
    }

    if (states.includes("delivered")) {
      const file = spec.finalFile ?? {
        filename: `${spec.client.handle.slice(1)}-delivery.zip`,
        mimeType: "application/zip",
        sizeBytes: 12_582_912,
      };
      await db.delivery.create({
        data: {
          commissionId: commission.id,
          filename: file.filename,
          sha256: randomBytes(32).toString("hex"),
          sizeBytes: file.sizeBytes,
          mimeType: file.mimeType,
          isFinal: true,
          loggedAt: at(states.indexOf("delivered")),
        },
      });
    }
  }
  return seeded;
}

export async function clearDemoCommissions(
  db: PrismaClient,
  creatorId: string,
) {
  const tables = [
    "follow_up_dms",
    "commission_events",
    "deliveries",
    "confirmations",
    "agreement_versions",
  ];
  await db.$transaction(async (tx) => {
    for (const table of tables) {
      await tx.$executeRawUnsafe(`ALTER TABLE "${table}" DISABLE TRIGGER USER`);
    }
    const ids = { creatorId };
    const where = `commission_id IN (SELECT id FROM commissions WHERE creator_id = $1::uuid)`;
    for (const table of [...tables, "invoices", "change_requests"]) {
      await tx.$executeRawUnsafe(
        `DELETE FROM "${table}" WHERE ${where}`,
        ids.creatorId,
      );
    }
    await tx.$executeRawUnsafe(
      `DELETE FROM commissions WHERE creator_id = $1::uuid`,
      ids.creatorId,
    );
    for (const table of tables) {
      await tx.$executeRawUnsafe(`ALTER TABLE "${table}" ENABLE TRIGGER USER`);
    }
  });
}

export function describeSeeded(
  seeded: SeededCommission[],
  baseUrl: string,
): string {
  return seeded
    .map((c) =>
      [
        `${c.state.padEnd(12)} ${c.title}`,
        `  editor  ${baseUrl}/commissions/${c.id}`,
        c.clientToken ? `  client  ${baseUrl}/a/${c.clientToken}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n");
}
