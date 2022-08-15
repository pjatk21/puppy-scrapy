import { gql } from '@apollo/client/core'

export const processFragmentMutation = gql`
  mutation ProcessFragment($html: String!) {
    processFragment(html: $html) {
      id
      code
      groups
      begin
    }
  }
`

export const tasksSubscription = gql`
  subscription Dispositions($tasksDispositionsScraperId: ID!) {
    tasksDispositions(scraperId: $tasksDispositionsScraperId) {
      id
      name
      state
      until
      since
    }
  }
`
