import React from 'react';
import PropTypes from 'prop-types';
import withIntl from '../lib/withIntl';
import { defineMessages, FormattedMessage, FormattedNumber, FormattedDate } from 'react-intl';
import { capitalize, formatCurrency } from '../lib/utils';
import { graphql } from 'react-apollo'
import gql from 'graphql-tag'
import Avatar from './Avatar';
import ExpenseDetails from './ExpenseDetails';
import ApproveExpenseBtn from './ApproveExpenseBtn';
import RejectExpenseBtn from './RejectExpenseBtn';
import PayExpenseBtn from './PayExpenseBtn';
import { Link } from '../server/pages';
import SmallButton from './SmallButton';

class Expense extends React.Component {

  static propTypes = {
    collective: PropTypes.object,
    expense: PropTypes.object,
    editable: PropTypes.bool,
    includeHostedCollectives: PropTypes.bool,
    LoggedInUser: PropTypes.object,
    allowPayAction: PropTypes.bool,
    lockPayAction: PropTypes.func,
    unlockPayAction: PropTypes.func 
  }

  constructor(props) {
    super(props);

    this.state = {
      modified: false,
      expense: {},
      mode: undefined
    };

    this.save = this.save.bind(this);
    this.handleChange = this.handleChange.bind(this);
    this.toggleDetails = this.toggleDetails.bind(this);
    this.toggleEdit = this.toggleEdit.bind(this);
    this.messages = defineMessages({
      'pending': { id: 'expense.pending', defaultMessage: 'pending' },
      'paid': { id: 'expense.paid', defaultMessage: 'paid' },
      'approved': { id: 'expense.approved', defaultMessage: 'approved' },
      'rejected': { id: 'expense.rejected', defaultMessage: 'rejected' },
      'closeDetails': { id: 'expense.closeDetails', defaultMessage: 'Close Details' },
      'edit': { id: 'expense.edit', defaultMessage: 'edit' },
      'cancelEdit': { id: 'expense.cancelEdit', defaultMessage: 'cancel edit' },
      'viewDetails': { id: 'expense.viewDetails', defaultMessage: 'View Details' }
    });
    this.currencyStyle = { style: 'currency', currencyDisplay: 'symbol', minimumFractionDigits: 2, maximumFractionDigits: 2};
  }

  toggleDetails() {
    this.setState({
      mode: this.state.mode === 'summary' ? 'details' : 'summary',
    });
  }

  cancelEdit() {
    this.setState({ modified: false, mode: 'details' });
  }

  edit() {
    this.setState({ modified: false, mode: 'edit' });
  }

  toggleEdit() {
    this.state.mode === 'edit' ? this.cancelEdit() : this.edit();
  }

  handleChange(expense) {
    this.setState({ modified: true, expense });
  }

  async save() {
    const expense = {
      id: this.props.expense.id,
      ...this.state.expense
    }
    const res = await this.props.editExpense(expense);
    this.setState({ modified: false, mode: 'details' });
  }

  render() {
    const {
      intl,
      collective,
      expense,
      includeHostedCollectives,
      LoggedInUser,
      editable
    } = this.props;

    const title = expense.description;
    const status = expense.status.toLowerCase();

    let { mode } = this.state;
    if (LoggedInUser && !mode) {
      if (expense.status === 'PENDING' && LoggedInUser.canApproveExpense(expense)) {
        mode = 'details';
      }
      if (expense.status === 'APPROVED' && LoggedInUser.canPayExpense(expense)) {
        mode = 'details';
      }
    }
    mode = mode || 'summary';

    const canReject = LoggedInUser
      && LoggedInUser.canApproveExpense(expense)
      && (
        expense.status === 'PENDING'
        || (expense.status === 'APPROVED' && (Date.now() - (new Date(expense.updatedAt).getTime())) < 60 * 1000 * 15) // we can reject an expense for up to 10mn after approving it
      );

    return (
      <div className={`expense ${status} ${this.state.mode}View`}>
        <style jsx>{`
          .expense {
            width: 100%;
            margin: 0.5em 0;
            padding: 0.5em;
            transition: max-height 1s cubic-bezier(0.25, 0.46, 0.45, 0.94);
            overflow: hidden;
            position: relative;
            display: flex;
          }
          .expense.detailsView {
            background-color: #fafafa;
          }
          a {
            cursor: pointer;
          }
          .fromCollective {
            float: left;
            margin-right: 1rem;
          }
          .body {
            overflow: hidden;
            font-size: 1.5rem;
            width: 100%;
          }
          .description {
            text-overflow: ellipsis;
            white-space: nowrap;
            overflow: hidden;
            display: block;
          }
          .meta {
            color: #919599;
            font-size: 1.2rem;
          }
          .meta .collective {
            margin-right: 0.2rem;
          }
          .amount .balance {
            font-size: 1.2rem;
            color: #919599;
          }
          .amount {
            width: 10rem;
            margin-left: 0.5rem;
            text-align: right;
            font-family: montserratlight, arial;
            font-size: 1.5rem;
            font-weight: 300;
          }
          .rejected .status {
            color: #e21a60;
          }
          .approved .status {
            color: #72ce00;
          }

          .status {
            text-transform: uppercase;
          }
          
          .actions > div {
            display: flex;
            margin: 0.5rem 0;
          }

          .actions .leftColumn {
            width: 72px;
            margin-right: 1rem;
            float: left;
          }

          @media(max-width: 600px) {
            .expense {
              max-height: 13rem;
            }
            .expense.detailsView {
              max-height: 45rem;
            }
            .details {
              max-height: 30rem;
            }
          }
        `}</style>
        <style jsx global>{`
          .expense .actions > div > div {
            margin-right: 0.5rem;
          }
        `}</style>
        <div className="fromCollective">
          <a href={`/${expense.fromCollective.slug}`} title={expense.fromCollective.name}>
            <Avatar src={expense.fromCollective.image} key={expense.fromCollective.id} radius={40} />
          </a>
        </div>
        <div className="body">
          <div className="description">
            <a onClick={this.toggleDetails} title={capitalize(title)}>{/* should link to `/${collective.slug}/expenses/${expense.uuid}` once we have a page for it */}
              {capitalize(title)}
            </a>
          </div>
          <div className="meta">
            <span className="incurredAt"><FormattedDate value={expense.incurredAt} day="numeric" month="numeric" /></span> |&nbsp;
            { includeHostedCollectives &&
              <span className="collective"><Link route={`/${expense.collective.slug}`}><a>{expense.collective.slug}</a></Link> (balance: {formatCurrency(expense.collective.stats.balance, expense.collective.currency)}) | </span>
            }
            <span className="status">{intl.formatMessage(this.messages[status])}</span> | 
            {` ${capitalize(expense.category)}`}
            { editable && LoggedInUser && LoggedInUser.canEditExpense(expense) &&
              <span> | <a onClick={this.toggleEdit}>{intl.formatMessage(this.messages[`${mode === 'edit' ? 'cancelEdit' : 'edit'}`])}</a></span>
            }
            { mode !== 'edit' &&
              <span> | <a onClick={this.toggleDetails}>{intl.formatMessage(this.messages[`${mode === 'details' ? 'closeDetails' : 'viewDetails'}`])}</a></span>
            }
          </div>

          <ExpenseDetails
            LoggedInUser={LoggedInUser}
            expense={expense}
            collective={collective}
            onChange={this.handleChange}
            mode={mode}
            />

          <div className="actions">
            { mode === 'edit' && this.state.modified &&
              <div>
                <div className="leftColumn"></div>
                <div className="rightColumn">
                  <SmallButton className="primary" onClick={this.save}><FormattedMessage id="expense.save" defaultMessage="save" /></SmallButton>
                </div>
              </div>
            }
            { mode !== 'edit' && LoggedInUser && LoggedInUser.canApproveExpense(expense) &&
              <div>
                { expense.status === 'APPROVED' && LoggedInUser.canPayExpense(expense) &&
                  <PayExpenseBtn
                    expense={expense}
                    disabled={!this.props.allowPayAction}
                    lock={this.props.lockPayAction}
                    unlock={this.props.unlockPayAction}
                    />
                }
                { expense.status !== 'APPROVED' && expense.status !== 'PAID' && <ApproveExpenseBtn id={expense.id} /> }
                { canReject && <RejectExpenseBtn id={expense.id} /> }
              </div>
            }
          </div>
        </div>
        <div className="amount">
          <FormattedNumber
            value={expense.amount / 100}
            currency={expense.currency}
            {...this.currencyStyle}
            />
        </div>
      </div>
    );
  }
}

const editExpenseQuery = gql`
mutation editExpense($expense: ExpenseInputType!) {
  editExpense(expense: $expense) {
    id
    description
    amount
    attachment
    category
    privateMessage
    payoutMethod
    status
  }
}
`;

const addMutation = graphql(editExpenseQuery, {
props: ( { mutate }) => ({
  editExpense: async (expense) => {
    return await mutate({ variables: { expense } })
  }
})
});

export default withIntl(addMutation(Expense));