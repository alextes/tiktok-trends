import { colors } from "https://deno.land/x/cliffy@v0.18.2/ansi/colors.ts";
import * as A from "https://deno.land/x/fun@v1.0.0/array.ts";
import * as TE from "https://deno.land/x/fun@v1.0.0/task_either.ts";
import * as E from "https://deno.land/x/fun@v1.0.0/either.ts";
import { flow, pipe } from "https://deno.land/x/fun@v1.0.0/fns.ts";

console.log(colors.bold.white("> crawling tiktok"));

const TIKAPI_API_KEY = Deno.env.get("TIKAPI_API_KEY");

if (TIKAPI_API_KEY === undefined) {
  throw new Error("Set TIKAPI_API_KEY env var before running");
}

const fetchJson = <A>(url: string): Promise<A> =>
  fetch(url, {
    headers: {
      "X-API-KEY": TIKAPI_API_KEY,
      "Accept-Encoding": "gzip, deflate, br",
    },
  }).then((res) => res.json());

/** unix timestamp */
type Timestamp = number;

type Challenge = {
  desc: string;
  id: string;
  title: string;
};

type Hashtag = {
  hashtagId: string;
  hashtagName: string;
};

type Item = {
  author: unknown;
  authorStats: {
    diggCount: number;
    followerCount: number;
    followingCount: number;
    heart: number;
    heartCount: number;
    videoCount: number;
  };
  challenges: Challenge[];
  createTime: Timestamp;
  desc: string;
  isAd: boolean;
  stats: {
    commentCount: number;
    diggCount: number;
    playCount: number;
    shareCount: number;
  };
  textExtra: Hashtag[];
};

type HashtagR = {
  itemList: Item[];
};

const fetchHashtagPage = (
  id: string,
  page: string,
): TE.TaskEither<Error, HashtagR> =>
  pipe(
    () =>
      fetchJson<HashtagR>(
        `https://api.tikapi.io/public/hashtag?id=${id}&count=20&cursor=${page}`,
      ),
    TE.fromFailableTask(
      (e) => new Error(String(e)),
    ),
  );

const range = (min: number, max: number) => {
  const arr = Array(max - min + 1)
    .fill(0)
    .map((_, i) => i + min);
  return arr;
};

const parTraverseTE = A.traverse(TE.Applicative);
const traverseTE = A.traverse(TE.ApplicativeSeq);
const fetchHashtagPages = (
  pageCount: number,
): TE.TaskEither<Error, HashtagR[]> =>
  pipe(
    range(0, pageCount),
    traverseTE((page) => fetchHashtagPage("15269703", String(page))),
    (te) => te as TE.TaskEither<Error, HashtagR[]>,
  );

const cache = ((await fetchHashtagPages(30)()) as any).right;
await Deno.writeTextFile("./cache.json", JSON.stringify(cache));

const hashtagFrequencyE = await pipe(
  // fetchHashtagPages(30),
  TE.right<never, HashtagR[]>(
    await Deno.readTextFile("./cache.json").then(JSON.parse),
  ),
  TE.map(
    flow(
      A.map(({ itemList }) => itemList),
      A._flatten,
      A.map((item) => item.textExtra),
      A._flatten,
      A.reduce((map, { hashtagName }) => {
        const frequency = map[hashtagName] || 0;
        map[hashtagName] = frequency + 1;
        return map;
      }, {} as Record<string, number>),
    ),
  ),
)();

const orderPairs = (
  [_A, rankA]: [unknown, number],
  [_B, rankB]: [unknown, number],
): number => rankB - rankA;

const noiseTerms = [
  "",
  "3070",
  "ad",
  "altcoins",
  "altcoinstobuy",
  "ballin",
  "belajarsaham",
  "biggie",
  "binance",
  "bitboycrypto",
  "bitcoinmines",
  "bitcoinmining",
  "blockchain",
  "buildingpc",
  "business",
  "bussit",
  "candle",
  "chinese",
  "college",
  "crypto",
  "cryptocurrency",
  "cryptoinvesting",
  "cryptomining",
  "cryptosecrets",
  "crytocurrency",
  "currency",
  "daytrading",
  "diy",
  "doritosduetroulette",
  "economy",
  "elonmusk",
  "entrepreneur",
  "entrepreneurship",
  "explainbitcoin",
  "fans",
  "finance",
  "financetiktok",
  "financialliteracy",
  "foeyou",
  "foryou",
  "foryoupage",
  "fy",
  "fyp",
  "garniermaskmoment",
  "gpu",
  "graffiti",
  "greenscreen",
  "greenscreenvideo",
  "handmade",
  "horseracing",
  "horses",
  "ilmusaham",
  "invest",
  "investasi",
  "investing",
  "investment",
  "investments",
  "japanese",
  "kentuckyderby",
  "learnontiktok",
  "learnontitkok",
  "love",
  "marker",
  "marketcrash",
  "millionaire",
  "millonario",
  "minecraft",
  "mining",
  "miningrig",
  "money",
  "moneytok",
  "nft",
  "nftart",
  "nftartwork",
  "nfts",
  "obligasi",
  "preciosopradal",
  "proud",
  "rich",
  "richgirl",
  "rigs",
  "saham",
  "setupropiojefe",
  "startupnerd",
  "stimulus",
  "stimuluscheck",
  "stitch", // TikTok feature to combine videos
  "stockmarket",
  "stocks",
  "stocktok",
  "stonks",
  "sukses",
  "tagging",
  "tags",
  "teambitcoin",
  "tesla",
  "thecryptoprofit",
  "toronto",
  "tothemoon",
  "trader",
  "trading",
  "trending",
  "trustfund",
  "turbotax",
  "turning18",
  "usa",
  "viral",
  "virtual",
  "wallstreetbets",
  "wealth",
  "whatitis",
  "windpower",
  "wolfofwallstreet",
  "xyzbca",
  "youngandrich",
  "iot",
];

type FrequencyMap = Record<string, number>;

const filteredTagsCount = pipe(
  hashtagFrequencyE,
  E.getOrElse<Error, FrequencyMap>((e) => {
    throw e;
  }),
  (arr) => Object.entries(arr),
  A.filter(([name]) => noiseTerms.includes(name)),
  (arr) => arr.length,
);

console.log(colors.gray(`${filteredTagsCount}`));

pipe(
  hashtagFrequencyE,
  E.getOrElse<Error, FrequencyMap>((e) => {
    throw e;
  }),
  (arr) => Object.entries(arr),
  A.filter(([name]) => !noiseTerms.includes(name)),
  (arr) => [...arr].sort(orderPairs),
  (arr) => arr.slice(0, 32),
  console.log,
);
