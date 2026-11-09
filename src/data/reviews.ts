export interface Review { name: string; type: string; person?: string; text: string[] }

/* Pořadí: první je výchozí aktivní (uprostřed). */
export const reviews: Review[] = [
  {
    name: 'Hrad Kašperk',
    type: 'Památka',
    text: [
      'Rozhodně bych ráda vyzdvihla jednoduchost, respektive uživatelsky velmi jednoduché rozhraní. I přes počáteční skepsi a porodní bolesti netrvalo dlouho a všechny funkce jsme obsáhli, naučili se používat filtry a nastavovat předprodeje, což pro náš provoz je jedna z nejdůležitějších věcí.',
      'Co bych ale zdůraznila mnohem více, je lidský přístup ze strany Cliqplace, jejich techniků a OZ. Jejich ochota být nám ku pomoci téměř 24/7 byla příjemným překvapením po předchozích zkušenostech.',
      'Věřím, že se s námi natrápili tak jako my s nimi, ale vše vedlo jednoznačně k úspěchu.',
      'Co jediné bych uvítala v budoucnu je počet vstupenek při předprodeji, respektive to, aby diváci/návštěvníci mohli vidět, kolik je volných vstupenek na danou akci v předprodeji. A jako druhý bod je lišta při prodeji „produktů“, která by mohla být širší, respektive ve dvou a více řadách pod sebou, aby brigádníci a zaměstnanci nemuseli lovit až někde v zadu. Ale to je spíše „kosmetický“ doplněk.',
      'Závěrem, rozhodně doporučuji spolupráci s Entradiem vyzkoušet, věřím, že mnoho památek by ocenilo jednoduchost a rychlost, kterou tento systém má.',
    ],
  },
  {
    name: 'Městská knihovna Most',
    type: 'Kino a knihovna',
    person: 'Petr Král, statutární zástupce ředitele',
    text: [
      'Entradio nám v kině i knihovně výrazně usnadnilo každodenní práci spojenou s prodejem vstupenek a správou akcí. Oceňujeme jeho intuitivní ovládání, spolehlivý provoz i přehledné informace o prodejích, díky kterým máme vše důležité rychle k dispozici. Velkým přínosem je pro nás také jednoduchý nákup vstupenek ve všech podobách z pohledu návštěvníků a s tím spojené snížení množství dotazů a administrativy.',
      'Stejně důležitá jako samotný systém je pro nás i spolupráce s týmem Entradia. Komunikace je rychlá, věcná a při řešení konkrétních potřeb vždy cítíme snahu najít funkční cestu. Cliqplace proto nevnímáme pouze jako dodavatele technologie, ale jako spolehlivého partnera, kterého můžeme s klidem doporučit i dalším kulturním a příspěvkovým organizacím.',
    ],
  },
  {
    name: 'Kino a divadlo Liteň',
    type: 'Kino a divadlo',
    text: ['V KD Liteň používáme Entradio na kino, divadlo i talkshow. Online prodej máme přímo na svém webu, předprodejní ceny se mění automaticky a pokladna s webem jsou propojené v reálném čase. Dárkové vouchery evidujeme v systému včetně e-mailu kupujícího. Velkým plusem je připravený MCP server: na prodeje a obsazenost se ptáme AI asistenta běžnou řečí, bez exportů. Pro kulturní zařízení je to ideální řešení, doporučujeme.'],
  },
  {
    name: 'Kino Hvězda Přerov',
    type: 'Kino',
    text: ['Přechodu na Entradio jsme se chvíli bránili, ale dnes víme, že zbytečně. Systém je jednoduchý a přehledný nejen pro naše pokladní. I návštěvníci si na něj bez problémů zvykli, a také programování filmů a obsluha našeho webu je díky němu snadná a intuitivní. Přehledné statistiky a uzávěrky jsou přesně to, co jsme potřebovali. Příjemným bonusem je pak technická podpora. Když potřebujeme, snaží se nám pomoci v co nejkratším čase a nestalo se, že by nás nechala na holičkách. Můžeme jenom doporučit.'],
  },
  {
    name: 'Kulturní dům města Soběslavi',
    type: 'Kulturní dům',
    text: ['Nejvíc na Cliqplace oceňujeme přístup lidí, kteří za ním stojí. Když je potřeba něco vyřešit, komunikace je rychlá a vždy najdeme řešení. Pro nás není jen dodavatel systému, ale partner, který rozumí tomu, jak organizace akcí ve skutečnosti funguje.'],
  },
  {
    name: 'Centrum kultury Písek',
    type: 'Divadlo',
    text: ['Entradio nám výrazně usnadnilo prodej divadelního předplatného. Oceňujeme především možnost nastavit celý proces přehledně a pohodlně jak pro nás, tak především pro naše návštěvníky. Díky novému systému nám zároveň odpadla nutnost blokování míst na jednotlivá představení, což celý proces prodeje zjednodušilo, zpřehlednilo a zefektivnilo.'],
  },
  {
    name: 'KZM Boskovice',
    type: 'Kulturní zařízení',
    text: ['Na Entradiu oceňuji především jeho jednoduchost a vysokou funkčnost. Šetří nám čas při zveřejňování programu a výrazně usnadňuje práci se vstupenkami – z pohledu diváka i provozovatele.'],
  },
  {
    name: 'KaSS Český Těšín',
    type: 'Kulturní zařízení',
    text: ['Entradio nám výrazně zjednodušilo prodej vstupenek. Systém je přehledný, nastavení zabere minimum času a nemusíme řešit žádné technikálie.'],
  },
  {
    name: 'Sirkus Sušice',
    type: 'Kulturní centrum',
    text: ['U Entradia se mi líbí široká možnost vlastní administrace samotného prodeje vstupenek a produktů. A zároveň oceňujeme rychlou a kvalitní zpětnou vazbu a podporu ze strany týmu Cliqplace.'],
  },
  {
    name: 'Jitka Keltie',
    type: 'Pořadatelka akcí',
    text: ['S Entradiem jsem moc spokojená. Systém je přehledný, vše funguje na jedničku. Oceňuji také perfektní komunikaci.'],
  },
  {
    name: 'Juniorfest',
    type: 'Festival',
    person: 'ředitelka a technický manager',
    text: ['Když pracujete na festivalu 19 let, zažijete spoustu technologických změn a málokdy vás něco opravdu nadchne. Vstupenkovému systému Entradio se to ale povedlo. Juniorfest je specifická a logisticky náročná akce, která potřebuje víc než jen obyčejný prodej lístků. Entradio nám poskytlo komplexní řešení od přehledných online rezervací a vstupenek až po hladké odbavení na místech konání. Jejich systém nám šetří čas, zjednodušuje komunikaci s diváky a dává nám jistotu, že celé technické zázemí ticketingu – včetně propojení s naším webem – funguje naprosto bezchybně. Pro Juniorfest už to není jen dodavatel, ale klíčový partner našeho úspěchu. Děkujeme za podporu.'],
  },
];
