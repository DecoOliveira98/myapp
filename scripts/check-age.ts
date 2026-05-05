import { calculateAge } from '../lib/calculations/nutrition';

type Case = {
    label: string;
    dob: string;
    today: string;
    expected: number;
};

const cases: Case[] = [
    { label: 'a', dob: '1998-12-29', today: '2026-05-03', expected: 27 },
    { label: 'b', dob: '1998-12-29', today: '2026-12-29', expected: 28 },
    { label: 'c', dob: '1998-12-29', today: '2026-12-28', expected: 27 },
    { label: 'd', dob: '2000-02-29', today: '2026-02-28', expected: 25 },
    { label: 'e', dob: '2000-02-29', today: '2026-03-01', expected: 26 },
];

const RealDate = Date;

function withMockedToday<T>(todayIso: string, fn: () => T): T {
    const fixedNow = new RealDate(`${todayIso}T12:00:00`);

    class MockDate extends RealDate {
        constructor(
            yearOrValue?: number | string | Date,
            month?: number,
            date?: number,
            hours?: number,
            minutes?: number,
            seconds?: number,
            ms?: number
        ) {
            if (yearOrValue === undefined) {
                super(fixedNow.getTime());
                return;
            }

            if (typeof yearOrValue === 'number' && month !== undefined) {
                super(yearOrValue, month, date ?? 1, hours ?? 0, minutes ?? 0, seconds ?? 0, ms ?? 0);
                return;
            }

            super(yearOrValue);
        }

        static now(): number {
            return fixedNow.getTime();
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).Date = MockDate as unknown as DateConstructor;

    try {
        return fn();
    } finally {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).Date = RealDate;
    }
}

let passed = 0;

for (const testCase of cases) {
    const actual = withMockedToday(testCase.today, () => calculateAge(testCase.dob));
    const ok = actual === testCase.expected;
    if (ok) passed += 1;

    console.log(
        `[${ok ? 'PASS' : 'FAIL'}] ${testCase.label}) DOB ${testCase.dob}, hoje ${testCase.today} -> ${actual} (esperado ${testCase.expected})`
    );
}

console.log(`\nResultado: ${passed}/${cases.length} casos passaram.`);
if (passed !== cases.length) {
    process.exit(1);
}
