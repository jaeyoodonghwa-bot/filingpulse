import type { EdgarSubmissionsPayload, TickerCikEntry } from "./types.js";

export const BUILTIN_TICKER_MAP: Record<string, TickerCikEntry> = {
  AAPL: {
    ticker: "AAPL",
    cik: "0000320193",
    companyName: "Apple Inc.",
    sic: "3571",
    sicDescription: "Electronic Computers",
  },
  NVDA: {
    ticker: "NVDA",
    cik: "0001045810",
    companyName: "NVIDIA CORP",
    sic: "3674",
    sicDescription: "Semiconductors & Related Devices",
  },
  MSFT: {
    ticker: "MSFT",
    cik: "0000789019",
    companyName: "MICROSOFT CORP",
    sic: "7372",
    sicDescription: "Services-Prepackaged Software",
  },
  TSLA: {
    ticker: "TSLA",
    cik: "0001318605",
    companyName: "Tesla, Inc.",
    sic: "3711",
    sicDescription: "Motor Vehicles & Passenger Car Bodies",
  },
  AMD: {
    ticker: "AMD",
    cik: "0000002488",
    companyName: "ADVANCED MICRO DEVICES INC",
    sic: "3674",
    sicDescription: "Semiconductors & Related Devices",
  },
  PLTR: {
    ticker: "PLTR",
    cik: "0001321655",
    companyName: "Palantir Technologies Inc.",
    sic: "7372",
    sicDescription: "Services-Prepackaged Software",
  },
  AMZN: {
    ticker: "AMZN",
    cik: "0001018724",
    companyName: "AMAZON COM INC",
    sic: "5961",
    sicDescription: "Retail-Catalog & Mail-Order Houses",
  },
  META: {
    ticker: "META",
    cik: "0001326801",
    companyName: "Meta Platforms, Inc.",
    sic: "7370",
    sicDescription: "Services-Computer Programming, Data Processing, Etc.",
  },
  GOOGL: {
    ticker: "GOOGL",
    cik: "0001652044",
    companyName: "Alphabet Inc.",
    sic: "7370",
    sicDescription: "Services-Computer Programming, Data Processing, Etc.",
  },
  COIN: {
    ticker: "COIN",
    cik: "0001679788",
    companyName: "Coinbase Global, Inc.",
    sic: "6199",
    sicDescription: "Finance Services",
  },
  MSTR: {
    ticker: "MSTR",
    cik: "0001050446",
    companyName: "Strategy Inc",
    sic: "7372",
    sicDescription: "Services-Prepackaged Software",
  },
  JPM: {
    ticker: "JPM",
    cik: "0000019617",
    companyName: "JPMORGAN CHASE & CO",
    sic: "6021",
    sicDescription: "National Commercial Banks",
  },
  ACME: {
    ticker: "ACME",
    cik: "0009999001",
    companyName: "ACME Financial Test Corp",
    sic: "7372",
    sicDescription: "Deterministic Fixture Test Entity",
  },
};

export interface TickerFixtureBundle {
  submissions: EdgarSubmissionsPayload;
  form4XmlByAccession: Record<string, string>;
}

function makeForm4Xml(params: {
  name: string;
  title: string;
  isOfficer: boolean;
  isDirector: boolean;
  isTenPercentOwner?: boolean;
  txDate: string;
  txCode: string;
  shares: number;
  price: number;
  sharesFollowing: number;
  is10b51?: boolean;
}): string {
  return `<?xml version="1.0"?>
<ownershipDocument>
  <aff10b5One>${params.is10b51 ? "1" : "0"}</aff10b5One>
  <reportingOwner>
    <reportingOwnerId>
      <rptOwnerName>${params.name}</rptOwnerName>
    </reportingOwnerId>
    <reportingOwnerRelationship>
      <isDirector>${params.isDirector ? "1" : "0"}</isDirector>
      <isOfficer>${params.isOfficer ? "1" : "0"}</isOfficer>
      <isTenPercentOwner>${params.isTenPercentOwner ? "1" : "0"}</isTenPercentOwner>
      <officerTitle>${params.title}</officerTitle>
    </reportingOwnerRelationship>
  </reportingOwner>
  <nonDerivativeTable>
    <nonDerivativeTransaction>
      <transactionDate><value>${params.txDate}</value></transactionDate>
      <transactionCoding><transactionCode>${params.txCode}</transactionCode></transactionCoding>
      <transactionAmounts>
        <transactionShares><value>${params.shares}</value></transactionShares>
        <transactionPricePerShare><value>${params.price}</value></transactionPricePerShare>
      </transactionAmounts>
      <postTransactionAmounts>
        <sharesOwnedFollowingTransaction><value>${params.sharesFollowing}</value></sharesOwnedFollowingTransaction>
      </postTransactionAmounts>
    </nonDerivativeTransaction>
  </nonDerivativeTable>
  ${params.is10b51 ? "<footnotes><footnote id=\"F1\">Executed pursuant to a Rule 10b5-1 trading plan.</footnote></footnotes>" : ""}
</ownershipDocument>`;
}

export const FIXTURE_DATA: Record<string, TickerFixtureBundle> = {
  AAPL: {
    submissions: {
      cik: "0000320193",
      name: "Apple Inc.",
      sic: "3571",
      sicDescription: "Electronic Computers",
      tickers: ["AAPL"],
      filings: {
        recent: {
          accessionNumber: [
            "0000320193-26-000142",
            "0000320193-26-000138",
            "0000320193-26-000131",
            "0000320193-26-000125",
          ],
          filingDate: ["2026-11-20", "2026-11-18", "2026-11-12", "2026-11-01"],
          reportDate: ["2026-11-19", "2026-11-17", "2026-11-10", "2026-10-31"],
          form: ["8-K", "4", "4", "8-K"],
          primaryDocument: [
            "aapl-20261120.htm",
            "wk-form4_1763480001.xml",
            "wk-form4_1762960002.xml",
            "aapl-20261101.htm",
          ],
          items: [["1.01", "2.02", "9.01"], [], [], ["2.02", "8.01", "9.01"]],
        },
      },
    },
    form4XmlByAccession: {
      "0000320193-26-000138": makeForm4Xml({
        name: "LEVINSON ARTHUR D",
        title: "Chairman of the Board",
        isOfficer: false,
        isDirector: true,
        txDate: "2026-11-17",
        txCode: "P",
        shares: 12000,
        price: 231.5,
        sharesFollowing: 4215000,
      }),
      "0000320193-26-000131": makeForm4Xml({
        name: "PAREKH KEVAN",
        title: "Chief Financial Officer",
        isOfficer: true,
        isDirector: false,
        txDate: "2026-11-10",
        txCode: "P",
        shares: 8500,
        price: 229.0,
        sharesFollowing: 48200,
      }),
    },
  },
  AMD: {
    submissions: {
      cik: "0000002488",
      name: "ADVANCED MICRO DEVICES INC",
      sic: "3674",
      sicDescription: "Semiconductors & Related Devices",
      tickers: ["AMD"],
      filings: {
        recent: {
          accessionNumber: [
            "0000002488-26-000210",
            "0000002488-26-000208",
            "0000002488-26-000205",
            "0000002488-26-000201",
            "0000002488-26-000190",
          ],
          filingDate: ["2026-11-22", "2026-11-21", "2026-11-19", "2026-11-16", "2026-11-04"],
          reportDate: ["2026-11-21", "2026-11-20", "2026-11-18", "2026-11-15", "2026-11-03"],
          form: ["8-K", "4", "4", "4", "8-K"],
          primaryDocument: [
            "amd-20261122.htm",
            "form4_su.xml",
            "form4_hu.xml",
            "form4_papermaster.xml",
            "amd-20261104.htm",
          ],
          items: [["1.01", "8.01", "9.01"], [], [], [], ["2.02", "9.01"]],
        },
      },
    },
    form4XmlByAccession: {
      "0000002488-26-000208": makeForm4Xml({
        name: "SU LISA T",
        title: "Chair and Chief Executive Officer",
        isOfficer: true,
        isDirector: true,
        txDate: "2026-11-20",
        txCode: "P",
        shares: 25000,
        price: 158.4,
        sharesFollowing: 3425000,
      }),
      "0000002488-26-000205": makeForm4Xml({
        name: "HU JEAN",
        title: "EVP, Chief Financial Officer",
        isOfficer: true,
        isDirector: false,
        txDate: "2026-11-18",
        txCode: "P",
        shares: 10000,
        price: 156.2,
        sharesFollowing: 184000,
      }),
      "0000002488-26-000201": makeForm4Xml({
        name: "PAPERMASTER MARK D",
        title: "EVP and Chief Technology Officer",
        isOfficer: true,
        isDirector: false,
        txDate: "2026-11-15",
        txCode: "P",
        shares: 8000,
        price: 155.0,
        sharesFollowing: 1190000,
      }),
    },
  },
  NVDA: {
    submissions: {
      cik: "0001045810",
      name: "NVIDIA CORP",
      sic: "3674",
      sicDescription: "Semiconductors & Related Devices",
      tickers: ["NVDA"],
      filings: {
        recent: {
          accessionNumber: [
            "0001045810-26-000311",
            "0001045810-26-000305",
            "0001045810-26-000298",
            "0001045810-26-000280",
          ],
          filingDate: ["2026-11-19", "2026-11-15", "2026-11-10", "2026-10-29"],
          reportDate: ["2026-11-19", "2026-11-14", "2026-11-09", "2026-10-28"],
          form: ["8-K", "4", "4", "8-K"],
          primaryDocument: [
            "nvda-20261119.htm",
            "form4_huang.xml",
            "form4_kress.xml",
            "nvda-20261029.htm",
          ],
          items: [["2.02", "8.01", "9.01"], [], [], ["8.01", "9.01"]],
        },
      },
    },
    form4XmlByAccession: {
      "0001045810-26-000305": makeForm4Xml({
        name: "HUANG JEN HSUN",
        title: "President and CEO",
        isOfficer: true,
        isDirector: true,
        txDate: "2026-11-14",
        txCode: "S",
        shares: 75000,
        price: 146.5,
        sharesFollowing: 75400000,
        is10b51: true,
      }),
      "0001045810-26-000298": makeForm4Xml({
        name: "KRESS COLETTE",
        title: "EVP & Chief Financial Officer",
        isOfficer: true,
        isDirector: false,
        txDate: "2026-11-09",
        txCode: "S",
        shares: 25000,
        price: 144.8,
        sharesFollowing: 3180000,
        is10b51: true,
      }),
    },
  },
  MSFT: {
    submissions: {
      cik: "0000789019",
      name: "MICROSOFT CORP",
      sic: "7372",
      sicDescription: "Services-Prepackaged Software",
      tickers: ["MSFT"],
      filings: {
        recent: {
          accessionNumber: [
            "0000789019-26-000118",
            "0000789019-26-000114",
            "0000789019-26-000102",
          ],
          filingDate: ["2026-11-18", "2026-11-12", "2026-10-28"],
          reportDate: ["2026-11-18", "2026-11-11", "2026-10-28"],
          form: ["8-K", "4", "8-K"],
          primaryDocument: ["msft-20261118.htm", "form4_nadella.xml", "msft-20261028.htm"],
          items: [["1.01", "8.01"], [], ["2.02", "9.01"]],
        },
      },
    },
    form4XmlByAccession: {
      "0000789019-26-000114": makeForm4Xml({
        name: "HOOD AMY",
        title: "EVP and Chief Financial Officer",
        isOfficer: true,
        isDirector: false,
        txDate: "2026-11-11",
        txCode: "P",
        shares: 4500,
        price: 448.2,
        sharesFollowing: 512000,
      }),
    },
  },
  TSLA: {
    submissions: {
      cik: "0001318605",
      name: "Tesla, Inc.",
      sic: "3711",
      sicDescription: "Motor Vehicles & Passenger Car Bodies",
      tickers: ["TSLA"],
      filings: {
        recent: {
          accessionNumber: [
            "0001318605-26-000199",
            "0001318605-26-000191",
            "0001318605-26-000175",
          ],
          filingDate: ["2026-11-21", "2026-11-14", "2026-10-24"],
          reportDate: ["2026-11-20", "2026-11-13", "2026-10-23"],
          form: ["8-K", "4", "8-K"],
          primaryDocument: ["tsla-20261121.htm", "form4_taneja.xml", "tsla-20261024.htm"],
          items: [["5.02", "8.01", "9.01"], [], ["2.02", "9.01"]],
        },
      },
    },
    form4XmlByAccession: {
      "0001318605-26-000191": makeForm4Xml({
        name: "TANEJA VAIBHAV",
        title: "Chief Financial Officer",
        isOfficer: true,
        isDirector: false,
        txDate: "2026-11-13",
        txCode: "S",
        shares: 7000,
        price: 332.0,
        sharesFollowing: 108000,
        is10b51: true,
      }),
    },
  },
  PLTR: {
    submissions: {
      cik: "0001321655",
      name: "Palantir Technologies Inc.",
      sic: "7372",
      sicDescription: "Services-Prepackaged Software",
      tickers: ["PLTR"],
      filings: {
        recent: {
          accessionNumber: [
            "0001321655-26-000164",
            "0001321655-26-000158",
            "0001321655-26-000140",
          ],
          filingDate: ["2026-11-22", "2026-11-16", "2026-11-05"],
          reportDate: ["2026-11-21", "2026-11-15", "2026-11-04"],
          form: ["8-K", "4", "8-K"],
          primaryDocument: ["pltr-20261122.htm", "form4_sankar.xml", "pltr-20261105.htm"],
          items: [["1.01", "9.01"], [], ["2.02", "9.01"]],
        },
      },
    },
    form4XmlByAccession: {
      "0001321655-26-000158": makeForm4Xml({
        name: "SANKAR SHYAM",
        title: "Chief Technology Officer",
        isOfficer: true,
        isDirector: false,
        txDate: "2026-11-15",
        txCode: "P",
        shares: 35000,
        price: 62.4,
        sharesFollowing: 1920000,
      }),
    },
  },
  ACME: {
    submissions: {
      cik: "0009999001",
      name: "ACME Financial Test Corp",
      sic: "7372",
      sicDescription: "Deterministic Fixture Test Entity",
      tickers: ["ACME"],
      filings: {
        recent: {
          accessionNumber: [
            "0009999001-26-000099",
            "0009999001-26-000095",
            "0009999001-26-000092",
            "0009999001-26-000088",
            "0009999001-26-000070",
          ],
          filingDate: ["2026-11-23", "2026-11-20", "2026-11-18", "2026-11-15", "2026-11-01"],
          reportDate: ["2026-11-22", "2026-11-19", "2026-11-17", "2026-11-14", "2026-10-31"],
          form: ["8-K", "4", "4", "4", "8-K"],
          primaryDocument: [
            "acme-20261123.htm",
            "form4_ceo.xml",
            "form4_cfo.xml",
            "form4_dir.xml",
            "acme-20261101.htm",
          ],
          items: [["4.02", "5.02", "9.01"], [], [], [], ["8.01", "9.01"]],
        },
      },
    },
    form4XmlByAccession: {
      "0009999001-26-000095": makeForm4Xml({
        name: "DOE JANE",
        title: "Chief Executive Officer",
        isOfficer: true,
        isDirector: true,
        txDate: "2026-11-19",
        txCode: "S",
        shares: 120000,
        price: 42.5,
        sharesFollowing: 50000,
        is10b51: false,
      }),
      "0009999001-26-000092": makeForm4Xml({
        name: "SMITH JOHN",
        title: "Chief Financial Officer",
        isOfficer: true,
        isDirector: false,
        txDate: "2026-11-17",
        txCode: "S",
        shares: 80000,
        price: 43.1,
        sharesFollowing: 10000,
        is10b51: false,
      }),
      "0009999001-26-000088": makeForm4Xml({
        name: "ROE RICHARD",
        title: "Director",
        isOfficer: false,
        isDirector: true,
        txDate: "2026-11-14",
        txCode: "S",
        shares: 45000,
        price: 44.0,
        sharesFollowing: 15000,
        is10b51: false,
      }),
    },
  },
};

export const FIXTURE_TICKERS = Object.keys(FIXTURE_DATA);
