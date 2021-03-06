// Copyright 2017-2020 @polkadot/app-accounts authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { ActionStatus } from '@polkadot/react-components/Status/types';
import { AccountId, ProxyDefinition, ProxyType, Voting } from '@polkadot/types/interfaces';
import { Delegation, SortedAccount } from '../types';

import BN from 'bn.js';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { isLedger } from '@polkadot/react-api';
import { useApi, useAccounts, useCall, useFavorites, useIpfs, useLoadingDelay, useToggle } from '@polkadot/react-hooks';
import { FormatBalance } from '@polkadot/react-query';
import { Button, Input, Table } from '@polkadot/react-components';
import { BN_ZERO } from '@polkadot/util';

import { useTranslation } from '../translate';
import CreateModal from '../modals/Create';
import ImportModal from '../modals/Import';
import Ledger from '../modals/Ledger';
import Multisig from '../modals/MultisigCreate';
import Proxy from '../modals/ProxiedAdd';
import Qr from '../modals/Qr';
import Account from './Account';
import BannerClaims from './BannerClaims';
import BannerExtension from './BannerExtension';
import { sortAccounts } from '../util';

interface Balances {
  accounts: Record<string, BN>;
  balanceTotal?: BN;
}

interface Sorted {
  sortedAccounts: SortedAccount[];
  sortedAddresses: string[];
}

interface Props {
  className?: string;
  onStatusChange: (status: ActionStatus) => void;
}

const STORE_FAVS = 'accounts:favorites';

function Overview ({ className = '', onStatusChange }: Props): React.ReactElement<Props> {
  const { t } = useTranslation();
  const { api } = useApi();
  const { allAccounts, hasAccounts } = useAccounts();
  const { isIpfs } = useIpfs();
  const [isCreateOpen, toggleCreate] = useToggle();
  const [isImportOpen, toggleImport] = useToggle();
  const [isLedgerOpen, toggleLedger] = useToggle();
  const [isMultisigOpen, toggleMultisig] = useToggle();
  const [isProxyOpen, toggleProxy] = useToggle();
  const [isQrOpen, toggleQr] = useToggle();
  const [favorites, toggleFavorite] = useFavorites(STORE_FAVS);
  const [{ balanceTotal }, setBalances] = useState<Balances>({ accounts: {} });
  const [filterOn, setFilter] = useState<string>('');
  const [sortedAccountsWithDelegation, setSortedAccountsWithDelegation] = useState<SortedAccount[] | undefined>();
  const [{ sortedAccounts, sortedAddresses }, setSorted] = useState<Sorted>({ sortedAccounts: [], sortedAddresses: [] });
  const delegations = useCall<Voting[]>(api.query.democracy?.votingOf?.multi, [sortedAddresses]);
  const proxies = useCall<[ProxyDefinition[], BN][]>(api.query.proxy?.proxies.multi, [sortedAddresses], {
    transform: (result: [([AccountId, ProxyType] | ProxyDefinition)[], BN][]): [ProxyDefinition[], BN][] =>
      api.tx.proxy.addProxy.meta.args.length === 3
        ? result as [ProxyDefinition[], BN][]
        : (result as [[AccountId, ProxyType][], BN][]).map(([arr, bn]): [ProxyDefinition[], BN] =>
          [arr.map(([delegate, proxyType]): ProxyDefinition => api.createType('ProxyDefinition', { delegate, proxyType })), bn]
        )
  });
  const isLoading = useLoadingDelay();

  const headerRef = useRef([
    [t('accounts'), 'start', 3],
    [t('type')],
    [t('tags'), 'start'],
    [t('transactions'), 'media--1500'],
    [t('Experience goods')],
    [t('Confiscated')],
    [t('Confiscation (kp)'), 'expand'],
    [t('Knowledge power (kp)'), 'expand'],
    [],
  ]);

  useEffect((): void => {

    const sortedAccounts = sortAccounts(allAccounts, favorites);
    const sortedAddresses = sortedAccounts.map((a) => a.account.address);
    console.log("sortedAccounts:"+JSON.stringify(sortedAccounts));
    console.log("sortedAccountsWithDelegation:"+JSON.stringify(sortedAccountsWithDelegation));

    setSorted({ sortedAccounts, sortedAddresses });
  }, [allAccounts, favorites]);

  useEffect(() => {
    console.log("delegations:"+delegations)
    if (api.query.democracy?.votingOf && !delegations?.length) {
      return;
    }

    setSortedAccountsWithDelegation(
      sortedAccounts?.map((account, index) => {
        let delegation: Delegation | undefined;
        console.log("delegations2:"+delegations)
        if (delegations && delegations[index]?.isDelegating) {
          const { balance: amount, conviction, target } = delegations[index].asDelegating;

          delegation = {
            accountDelegated: target.toString(),
            amount,
            conviction
          };
        }
      console.log("sortedAccountsWithDelegation2:"+JSON.stringify(sortedAccountsWithDelegation));
        return ({
          ...account,
          delegation
        });
      })
    );
  }, [api, delegations, sortedAccounts]);

  const _setBalance = useCallback(
    (account: string, balance: BN) =>
      setBalances(({ accounts }: Balances): Balances => {
        accounts[account] = balance;
        console.log("balance:"+balance)
        console.log(" accounts[account]:"+ accounts[account])
        return {
          accounts,
          balanceTotal: Object.values(accounts).reduce((total: BN, value: BN) => total.add(value), BN_ZERO)
        };
      }),
    []
  );

  const footer = useMemo(() => (
    <tr>
      <td colSpan={3} />
      <td className='media--1400' />
      <td colSpan={2} />
      <td className='media--1500' />
      <td />
      <td />
      <td className='number'>
        
      </td>
      <td className='number'>
       
      </td>
      <td />
    </tr>
  ), [balanceTotal]);

  const filter = useMemo(() => (
    <div className='filter--tags'>
      <Input
        autoFocus
        isFull
        label={t<string>('filter by name or tags')}
        onChange={setFilter}
        value={filterOn}
      />
    </div>
  ), [filterOn, t]);

  return (
    <div className={className}>
      <Table
        empty={(!hasAccounts || (!isLoading && sortedAccountsWithDelegation)) && t<string>("You don't have any accounts. Some features are currently hidden and will only become available once you have accounts.")}
        filter={filter}
        footer={footer}
        header={headerRef.current}
      >
        {!isLoading && sortedAccountsWithDelegation?.map(({ account, delegation, isFavorite }, index): React.ReactNode => (
          <Account
            account={account}
            delegation={delegation}
            filter={filterOn}
            isFavorite={isFavorite}
            key={account.address}
            proxy={proxies?.[index]}
            setBalance={_setBalance}
            toggleFavorite={toggleFavorite}
          />
        ))}
      </Table>
    </div>
  );
}

export default React.memo(styled(Overview)`
  .filter--tags {
    .ui--Dropdown {
      padding-left: 0;

      label {
        left: 1.55rem;
      }
    }
  }
`);
