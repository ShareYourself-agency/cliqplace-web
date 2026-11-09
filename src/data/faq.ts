export interface FaqItem { q: string; a: string[] }

/** Homepage – 4 hlavní dotazy */
export const faqMain: FaqItem[] = [
  {
    q: 'Pro koho je Cliqplace určený?',
    a: [
      'Pro každého, kdo prodává vstupenky, zboží nebo služby a potřebuje návštěvníky odbavit na místě. Patří sem divadla, kina, kluby, koncertní sály, festivaly, sportoviště, muzea, galerie, zoo, aquaparky i pořadatelé firemních akcí a konferencí. Základem je systém Entradio, který zvládne malý klubový večer i velký areál s turnikety a několika vstupy.',
    ],
  },
  {
    q: 'Musím odebírat celé řešení, nebo si můžu vybrat jen část?',
    a: [
      'Nemusíte odebírat všechno. Základem je software Entradio a k němu si přidáte jen ty moduly, které opravdu využijete: online prodej přes portál mytickets.vip nebo pod vlastní značkou, pokladny, samoobslužné kiosky nebo odbavovací hardware. Řešení můžete rozšiřovat postupně, jak budete růst. Hardware lze odebírat i samostatně, nejlépe ale funguje s Entradiem, pro které ho máme ověřený.',
    ],
  },
  {
    q: 'Jak probíhá přechod a jak rychle můžeme začít prodávat?',
    a: [
      'Na úvodní konzultaci probereme, jak dnes prodáváte a odbavujete. Pak systém nastavíme za vás: akce, sály, ceny i typy vstupenek. Převedeme data, která váš současný systém umožní přenést, nainstalujeme hardware a zaškolíme personál, i když většinu zvládnete i bez školení. Online prodej obvykle spustíte během několika dní, někdy už do 24 hodin od dodání kompletních podkladů. U větších areálů s hardwarem záleží na typu zařízení, obvykle jde o jeden až osm týdnů.',
    ],
  },
  {
    q: 'Kolik to stojí?',
    a: ['Cenu připravujeme na míru podle velikosti provozu a modulů, které využijete. Nezávaznou nabídku vám pošleme do 2–3 pracovních dnů od úvodní konzultace.'],
  },
];

/** Podstránka Další dotazy */
export const faqMore: FaqItem[] = [
  {
    q: 'Lze systém přizpůsobit naší vlastní značce?',
    a: ['Ano. Díky white-label řešení probíhá prodej na vaší vlastní doméně, ve vašich barvách a s vaším logem. Zákazník nakupuje u vás, ne na cizí platformě, a jeho data zůstávají jen u vás.'],
  },
  {
    q: 'Zajišťuje Cliqplace i hardware?',
    a: ['Ano. Hardware dodáme nebo pronajmeme podle vašich potřeb: turnikety, pokladní PC, samoobslužné kiosky, čtečky vstupenek, tiskárny, platební terminály i výdejní boxy na objednané zboží. Všechno je propojené s Entradiem, takže odbavení QR kódem trvá méně než sekundu a obejdete se bez papíru. Postaráme se o instalaci i servis.'],
  },
  {
    q: 'Kdy dostanu peníze z prodeje?',
    a: ['Průběžně, v intervalu podle vaší dohody s námi. Tržby neblokujeme až do konce předprodeje, takže s penězi můžete počítat hned.'],
  },
  {
    q: 'Jaké platební metody mohou zákazníci použít?',
    a: ['Platební kartu, Apple Pay, Google Pay, bankovní převod, dárkovou kartu, platbu na pokladně i platbu na fakturu.'],
  },
  {
    q: 'Můžu prodávat i zboží, občerstvení nebo služby?',
    a: ['Ano. V Entradiu prodáte kromě vstupenek také občerstvení, merch, dárkové karty i služby. Prodávat je můžete online i na pokladně a objednané zboží si zákazník může vyzvednout ve výdejním boxu. Přehled tržeb za vstupenky i bar máte na jednom místě.'],
  },
  {
    q: 'Jaké přehledy a statistiky systém nabízí?',
    a: ['Statistiky prodeje vidíte v reálném čase podle akcí, titulů, dnů, typů vstupenek i produktů. Snadno porovnáte letošní a loňskou sezonu nebo zjistíte, které akce vydělávají nejvíc.'],
  },
  {
    q: 'Jde Entradio propojit s naším webem, účetnictvím nebo dalšími systémy?',
    a: ['Ano. Prodej napojíte na své stávající stránky přes API nebo iFrame. Entradio umí spolupracovat také s vybranými účetními programy, městskými informačními systémy a dalšími aplikacemi.'],
  },
  {
    q: 'Co když na místě vypadne internet?',
    a: ['Zařízení lze záložně připojit přes mobilní síť, takže prodej a odbavení mohou pokračovat i při výpadku pevného připojení.'],
  },
  {
    q: 'Jak funguje podpora?',
    a: ['Podpora je k dispozici 7 dní v týdnu. Pomůže s nastavením, s provozem i ve chvíli, kdy se na místě něco pokazí.'],
  },
  {
    q: 'Jak je to s ochranou dat a GDPR?',
    a: ['Data vašich zákazníků patří vám a nesdílíme je s jinými pořadateli. Ukládáme je na serverech v EU a s každým klientem uzavíráme smlouvu o zpracování osobních údajů.'],
  },
];
