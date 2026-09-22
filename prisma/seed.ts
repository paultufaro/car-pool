import { GroupType, MemberRole, PrismaClient, SwapStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { geocode } from "../src/lib/geocoding";
import { buildRotation, startOfDayUtc } from "../src/lib/schedule";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "carpool123";

type SeedFamily = {
  name: string;
  email: string;
  phone: string;
  address: string;
  children: { firstName: string; grade: string }[];
};

const FAMILIES: SeedFamily[] = [
  {
    name: "Dana Alvarez",
    email: "dana@example.com",
    phone: "+19735550101",
    address: "24 Beekman Rd, Summit, NJ",
    children: [{ firstName: "Mia", grade: "3rd" }],
  },
  {
    name: "Marcus Bell",
    email: "marcus@example.com",
    phone: "+19735550102",
    address: "91 Blackburn Rd, Summit, NJ",
    children: [{ firstName: "Theo", grade: "3rd" }],
  },
  {
    name: "Priya Chandra",
    email: "priya@example.com",
    phone: "+19735550103",
    address: "15 Oak Ridge Ave, Summit, NJ",
    children: [
      { firstName: "Anika", grade: "3rd" },
      { firstName: "Rohan", grade: "5th" },
    ],
  },
  {
    name: "Jen Donnelly",
    email: "jen@example.com",
    phone: "+19735550104",
    address: "7 Hillcrest Ave, Summit, NJ",
    children: [{ firstName: "Callie", grade: "U10" }],
  },
  {
    name: "Sam Whitaker",
    email: "sam@example.com",
    phone: "+19735550105",
    address: "38 Ashwood Ave, Summit, NJ",
    children: [{ firstName: "Jonah", grade: "U10" }],
  },
  {
    name: "Nina Okafor",
    email: "nina@example.com",
    phone: "+19735550106",
    address: "102 Springfield Ave, New Providence, NJ",
    children: [{ firstName: "Ada", grade: "U10" }],
  },
];

async function reset() {
  await prisma.swapRequest.deleteMany();
  await prisma.drivingAssignment.deleteMany();
  await prisma.routeMember.deleteMany();
  await prisma.route.deleteMany();
  await prisma.groupMember.deleteMany();
  await prisma.group.deleteMany();
  await prisma.notificationLog.deleteMany();
  await prisma.verificationCode.deleteMany();
  await prisma.child.deleteMany();
  await prisma.user.updateMany({ data: { familyId: null } });
  await prisma.family.deleteMany();
  await prisma.user.deleteMany();
}

async function createFamily(seed: SeedFamily) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const now = new Date();
  const user = await prisma.user.create({
    data: {
      name: seed.name,
      email: seed.email,
      phone: seed.phone,
      passwordHash,
      emailVerifiedAt: now,
      phoneVerifiedAt: now,
    },
  });
  const location = await geocode(seed.address);
  const family = await prisma.family.create({
    data: {
      primaryUserId: user.id,
      homeAddress: seed.address,
      neighborhood: location.neighborhood,
      homeLat: location.lat,
      homeLng: location.lng,
      children: { create: seed.children },
    },
  });
  await prisma.user.update({ where: { id: user.id }, data: { familyId: family.id } });
  return { user, family };
}

async function main() {
  await reset();

  const families = [];
  for (const seed of FAMILIES) {
    families.push(await createFamily(seed));
  }
  const [dana, marcus, priya, jen, sam, nina] = families;

  const schoolAnchor = await geocode("52 Woodland Ave, Summit, NJ");
  const school = await prisma.group.create({
    data: {
      name: "Lincoln-Hubbard 3rd Grade",
      type: GroupType.SCHOOL,
      inviteCode: "SUMMIT23",
      adminUserId: dana.user.id,
      anchorAddress: "52 Woodland Ave, Summit, NJ",
      anchorLat: schoolAnchor.lat,
      anchorLng: schoolAnchor.lng,
      members: {
        create: [
          { userId: dana.user.id, role: MemberRole.ADMIN },
          { userId: marcus.user.id },
          { userId: priya.user.id },
          { userId: jen.user.id },
        ],
      },
    },
  });

  const fieldAnchor = await geocode("Shunpike Field, Chatham, NJ");
  const soccer = await prisma.group.create({
    data: {
      name: "Summit Soccer Club U10 Travel",
      type: GroupType.SPORTS,
      inviteCode: "SSCU10TR",
      adminUserId: jen.user.id,
      anchorAddress: "Shunpike Field, Chatham, NJ",
      anchorLat: fieldAnchor.lat,
      anchorLng: fieldAnchor.lng,
      members: {
        create: [
          { userId: jen.user.id, role: MemberRole.ADMIN },
          { userId: sam.user.id },
          { userId: nina.user.id },
          { userId: dana.user.id },
        ],
      },
    },
  });

  const morningOrigin = await geocode("Summit, NJ — Beekman Rd area");
  const morning = await prisma.route.create({
    data: {
      groupId: school.id,
      createdById: dana.user.id,
      name: "Morning drop-off",
      originDescription: "Summit, NJ — Beekman Rd area",
      originLat: morningOrigin.lat,
      originLng: morningOrigin.lng,
      destinationDescription: "52 Woodland Ave, Summit, NJ",
      destinationLat: schoolAnchor.lat,
      destinationLng: schoolAnchor.lng,
      daysOfWeek: [1, 2, 3, 4, 5],
      timeWindowStart: "07:45",
      timeWindowEnd: "08:10",
      rotationWeeks: 1,
      matchRadiusMiles: 1.5,
      members: {
        create: [{ familyId: dana.family.id }, { familyId: marcus.family.id }],
      },
    },
  });

  const pickupOrigin = await geocode("52 Woodland Ave, Summit, NJ");
  const afternoon = await prisma.route.create({
    data: {
      groupId: school.id,
      createdById: priya.user.id,
      name: "Wednesday early dismissal",
      originDescription: "52 Woodland Ave, Summit, NJ",
      originLat: pickupOrigin.lat,
      originLng: pickupOrigin.lng,
      destinationDescription: "Summit, NJ — Oak Ridge Ave area",
      destinationLat: priya.family.homeLat,
      destinationLng: priya.family.homeLng,
      daysOfWeek: [3],
      timeWindowStart: "12:45",
      timeWindowEnd: "13:00",
      rotationWeeks: 1,
      matchRadiusMiles: 2,
      members: { create: [{ familyId: priya.family.id }] },
    },
  });

  const practiceOrigin = await geocode("Summit, NJ — Memorial Field lot");
  const practice = await prisma.route.create({
    data: {
      groupId: soccer.id,
      createdById: jen.user.id,
      name: "Tue/Thu practice run to Chatham",
      originDescription: "Summit, NJ — Memorial Field lot",
      originLat: practiceOrigin.lat,
      originLng: practiceOrigin.lng,
      destinationDescription: "Shunpike Field, Chatham, NJ",
      destinationLat: fieldAnchor.lat,
      destinationLng: fieldAnchor.lng,
      daysOfWeek: [2, 4],
      timeWindowStart: "16:30",
      timeWindowEnd: "16:50",
      rotationWeeks: 2,
      matchRadiusMiles: 3,
      members: {
        create: [
          { familyId: jen.family.id },
          { familyId: sam.family.id },
          { familyId: nina.family.id },
        ],
      },
    },
  });

  const today = startOfDayUtc(new Date());
  for (const route of [morning, afternoon, practice]) {
    const members = await prisma.routeMember.findMany({
      where: { routeId: route.id },
      orderBy: { joinedAt: "asc" },
    });
    const rotation = buildRotation(
      members.map((member) => member.familyId),
      route.daysOfWeek,
      route.rotationWeeks,
      today,
    );
    await prisma.drivingAssignment.createMany({
      data: rotation.map((entry) => ({
        routeId: route.id,
        familyId: entry.familyId,
        date: entry.date,
      })),
      skipDuplicates: true,
    });
  }

  // One open swap so the demo starts with something to claim.
  const swapTarget = await prisma.drivingAssignment.findFirst({
    where: { routeId: practice.id, familyId: jen.family.id, date: { gte: today } },
    orderBy: { date: "asc" },
  });
  if (swapTarget) {
    await prisma.swapRequest.create({
      data: {
        assignmentId: swapTarget.id,
        requestedById: jen.user.id,
        note: "Work trip — can anyone cover?",
        status: SwapStatus.OPEN,
      },
    });
  }

  console.info(
    `Seeded ${families.length} families, 2 groups, 3 routes. Log in with any of: ${FAMILIES.map(
      (family) => family.email,
    ).join(", ")} (password: ${DEMO_PASSWORD})`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
